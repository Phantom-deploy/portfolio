// Python Browser Fallback for homework code runners
// -------------------------------------------------
// NEW file. It does not replace or edit any existing file in the repo.
//
// What it does:
//   The OCS code runner (CodeExecutor.js) sends Python code to the Flask
//   backend at <pythonURI>/run/python. If that backend cannot be reached
//   (no local server on port 8587, or the backend blocks this site), the
//   request fails with "Failed to fetch".
//
//   This file watches for that one request. If it fails, it runs the same
//   Python code in the browser with Pyodide and hands the output back to the
//   code runner, so the runner shows the result like normal.
//
//   Every other request (login, analytics, Java, etc.) is left alone.
//
// How to use it: add this line in a markdown cell of a notebook.
//   <script src="{{site.baseurl}}/assets/js/homework/python-browser-fallback.js"></script>

(function () {
    if (window.__hwPythonFallback) return; // only install once per page
    window.__hwPythonFallback = true;

    var realFetch = window.fetch.bind(window);
    var PYODIDE_BASE = 'https://cdn.jsdelivr.net/npm/pyodide@0.26.4/';
    var pyodidePromise = null;

    // Load Pyodide one time, the first time it is needed.
    function loadPyodideOnce() {
        if (pyodidePromise) return pyodidePromise;
        pyodidePromise = new Promise(function (resolve, reject) {
            function start() {
                window.loadPyodide({ indexURL: PYODIDE_BASE }).then(resolve, reject);
            }
            if (window.loadPyodide) return start();
            var script = document.createElement('script');
            script.src = PYODIDE_BASE + 'pyodide.js';
            script.onload = start;
            script.onerror = function () {
                reject(new Error('Could not load in-browser Python'));
            };
            document.head.appendChild(script);
        }).catch(function (err) {
            pyodidePromise = null; // let the next Run try again
            throw err;
        });
        return pyodidePromise;
    }

    // Run Python code and return everything it printed.
    async function runInBrowser(code) {
        var pyodide = await loadPyodideOnce();
        var lines = [];
        pyodide.setStdout({ batched: function (text) { lines.push(text); } });
        pyodide.setStderr({ batched: function (text) { lines.push(text); } });
        var globals = pyodide.globals.get('dict')(); // fresh variables every run
        try {
            await pyodide.runPythonAsync(code, { globals: globals });
        } catch (pyErr) {
            // Show only the last line of the Python error, like "ValueError: boom".
            var message = String(pyErr.message || pyErr).trim().split('\n');
            lines.push(message[message.length - 1]);
        } finally {
            globals.destroy();
        }
        return lines.length ? lines.join('\n') : '[no output]';
    }

    window.fetch = async function (input, init) {
        var url = typeof input === 'string' ? input : ((input && input.url) || '');
        if (!/\/run\/python$/.test(url)) return realFetch(input, init);

        try {
            return await realFetch(input, init); // use the backend when it is up
        } catch (networkErr) {
            var code = '';
            try { code = JSON.parse((init && init.body) || '{}').code || ''; } catch (e) { }
            var output;
            try {
                output = await runInBrowser(code);
            } catch (loadErr) {
                output = 'Error: backend not reachable and ' + loadErr.message;
            }
            // Same shape as the Flask backend's reply: { "output": "..." }
            return new Response(JSON.stringify({ output: output }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
    };
})();