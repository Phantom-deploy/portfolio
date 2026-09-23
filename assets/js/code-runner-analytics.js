/*
 * assets/js/code-runner-analytics.js
 *
 * This file has two parts.
 *
 * PART 1  The CODE_RUNNER analytics tracker that is already in the repo. It still
 *         auto-detects FRQ pages, hooks code blocks and CodeMirror editors, and reports
 *         copy, paste, execute, success and error events to ENHANCED_ANALYTICS and
 *         OCSEnhancedAnalytics. Three repairs were needed, listed below, because the
 *         version in the repo does not parse, so none of it was running.
 *
 * PART 2  A local fallback for the code runners, so a lesson page stops printing
 *         "Error: Failed to fetch" when the backend cannot be reached.
 *
 * ---------------------------------------------------------------------------------
 * PART 1 REPAIRS (nothing else in the tracker was touched)
 *
 * 1. A comma was missing after recordCodeExecution, and the block after it had lost its
 *    method header, so the file ended with "Unexpected identifier 'editor'". A browser
 *    throws that at parse time and runs NONE of the file. That orphaned block is now a
 *    method named hookIntoEditor, with the `editor` lookup it was missing.
 * 2. Two selectors used `button:contains("Run")`, which is jQuery syntax, not CSS.
 *    querySelector throws on it, which stopped hookCodeMirrorEditor and hookIntoExecutor
 *    part way through. Both now go through safeQuery, which falls back to the valid part.
 * 3. Nothing else. Every tracker behavior, event name and console message is unchanged.
 *
 * ---------------------------------------------------------------------------------
 * WHY "Failed to fetch" HAPPENS
 *
 * CodeExecutor.run() posts every language to a backend:
 *     python      -> ${pythonURI}/run/python
 *     javascript  -> ${pythonURI}/run/javascript
 *     java        -> ${javaURI}/run/java
 *
 * config.js sets `credentials: \'include\'`, and a credentialed CORS request is refused
 * unless the server echoes this exact origin back in Access-Control-Allow-Origin. On a
 * fork served from a github.io origin, or when flask.opencodingsociety.com is down, the
 * request fails before it is sent and the browser reports "Failed to fetch".
 * CodeExecutor does have an in browser JavaScript fallback, but it is gated behind
 * `isLocalhost`, so on a deployed site it can never run.
 *
 * WHAT PART 2 DOES
 *
 * This is a classic script, so it runs before any `type="module"` script on the page,
 * which means it is in place before any runner is built. It wraps window.fetch and
 * watches only for the three run endpoints above. Every other request on the site is
 * passed straight through, untouched.
 *
 *   1. Try the real backend once.
 *   2. If the backend answers, hand that answer back and change nothing.
 *   3. If it fails, run the code locally and return a normal JSON Response shaped
 *      exactly like the backend\'s, so CodeExecutor needs no changes.
 *
 * Once the backend has failed, that is remembered for the rest of the page load and
 * later runs go straight to local execution with no waiting.
 *
 *   JavaScript -> executed by the browser itself
 *   Python     -> executed by Pyodide, the same CDN and version already used by
 *                 _includes/hack.html, loaded only when a Python cell is actually run
 *   Java       -> passed through, since a browser has no Java engine
 */

(function () {
    function safeQuery(root, selector) {
        // `button:contains("Run")` is jQuery syntax, not CSS. querySelector throws on it,
        // which used to stop hookCodeMirrorEditor and hookIntoExecutor part way through.
        // Try the selector, and on failure fall back to the valid part of it.
        try {
            return root.querySelector(selector);
        } catch (e) {
            var valid = selector
                .split(',')
                .filter(function (part) { return part.indexOf(':contains(') === -1; })
                .join(',');
            try {
                return valid ? root.querySelector(valid) : null;
            } catch (e2) {
                return null;
            }
        }
    }

    const CodeRunnerAnalytics = {
        /**
         * Auto-initialize on any FRQ page with codemirror
         * Detects by: frq_number in page, codemirror editors, CODE_RUNNER comments
         */
        autoInit: function () {
            console.log('🎯 CODE_RUNNER Analytics: Auto-detecting FRQ pages...');

            // Check if this is an FRQ page (look for frq_number in page structure or classes)
            const isFRQPage = this.isFRQPage();

            if (!isFRQPage) {
                console.log('Not an FRQ page, skipping CODE_RUNNER analytics');
                return;
            }

            // Find all code blocks that have CODE_RUNNER comment
            this.hookAllCodeRunnerBlocks();
        },

        /**
         * Detect if current page is an FRQ lesson
         */
        isFRQPage: function () {
            // Check for Jekyll post with frq_number in frontmatter (look in page structure)
            // Methods:
            // 1. Check if page has codemirror textarea (indicator of code lesson)
            const hasCodeMirror = document.querySelector('.CodeMirror') ||
                document.querySelector('textarea[data-codemirror]') ||
                document.querySelector('.codemirror');

            // 2. Check page title or URL for 'frq'
            const isFRQTitle = document.title.toLowerCase().includes('frq') ||
                window.location.pathname.includes('frq');

            // 3. Check for code blocks with CODE_RUNNER comment
            const hasCodeRunner = Array.from(document.querySelectorAll('pre, code')).some(el =>
                el.textContent.includes('// CODE_RUNNER:')
            );

            return hasCodeMirror || isFRQTitle || hasCodeRunner;
        },

        /**
         * Find and hook all CODE_RUNNER code blocks on the page
         */
        hookAllCodeRunnerBlocks: function () {
            // Look for code blocks containing "// CODE_RUNNER:" comment
            const codeBlocks = document.querySelectorAll('pre, code, [data-codemirror], .CodeMirror');
            let hooked = 0;

            codeBlocks.forEach((block, index) => {
                const text = block.textContent || block.innerText || '';

                // Check if this block has CODE_RUNNER comment
                if (text.includes('// CODE_RUNNER:')) {
                    console.log(`📌 Found CODE_RUNNER block #${index + 1}`);
                    this.hookCodeBlock(block, index);
                    hooked++;
                }
            });

            console.log(`✅ CODE_RUNNER Analytics: Hooked ${hooked} code block(s)`);

            // Also hook any CodeMirror instances found
            if (window.CodeMirror && window.CodeMirror.getAllCodeMirrors) {
                const editors = window.CodeMirror.getAllCodeMirrors();
                editors.forEach((cm, idx) => {
                    this.hookCodeMirrorEditor(cm, idx);
                });
            }
        },

        /**
         * Hook a single code block for copy/paste/execute tracking
         */
        hookCodeBlock: function (block, index) {
            // Wrap the block with tracking
            const blockId = `code-block-${index}`;
            block.id = blockId;
            block.dataset.codeRunner = 'true';

            // Track copy
            block.addEventListener('copy', (e) => {
                const selectedText = window.getSelection().toString();
                if (selectedText.length > 0) {
                    this.recordCodeCopy(selectedText, blockId);
                }
            });
        },

        /**
         * Hook CodeMirror editor instance
         */
        hookCodeMirrorEditor: function (cm, index) {
            console.log(`📝 Hooked CodeMirror editor #${index}`);

            const editorId = `codemirror-${index}`;

            // Track copy from editor
            cm.on('copy', (instance, event) => {
                const selectedText = instance.getSelection();
                if (selectedText) {
                    this.recordCodeCopy(selectedText, editorId);
                }
            });

            // Track execution (look for run button clicks)
            const parentContainer = cm.getWrapperElement().closest('.CodeMirror-container, [data-code-runner], pre, code') ||
                cm.getWrapperElement().parentElement;

            if (parentContainer) {
                const runButton = safeQuery(parentContainer, '[data-action="run"], .btn-run, button:contains("Run"), button:contains("Execute")');
                if (runButton) {
                    runButton.addEventListener('click', () => {
                        const code = cm.getValue();
                        this.recordCodeExecution(code, editorId);
                    });
                }
            }
        },

        /**
         * Record code copy event
         */
        recordCodeCopy: function (code, blockId) {
            if (!window.ENHANCED_ANALYTICS) {
                console.warn('Enhanced analytics not loaded');
                return;
            }

            console.log(`📋 CODE_RUNNER Copy: ${code.length} chars from ${blockId}`);

            ENHANCED_ANALYTICS.recordEvent('CODE_COPY', {
                source: 'code_runner',
                blockId: blockId,
                codeLength: code.length,
                snippet: code.substring(0, 100) + (code.length > 100 ? '...' : '')
            });
        },

        /**
         * Record code execution
         */
        recordCodeExecution: function (code, blockId) {
            if (!window.ENHANCED_ANALYTICS) {
                console.warn('Enhanced analytics not loaded');
                return;
            }

            console.log(`⚙️ CODE_RUNNER Execute from ${blockId}`);

            ENHANCED_ANALYTICS.recordEvent('CODE_EXECUTE', {
                source: 'code_runner',
                blockId: blockId,
                codeLength: code.length
            });
        },

        /**
         * Hook the editor element of one runner (copy and paste inside the editor)
         */
        hookIntoEditor: function () {
            const editor = this.container &&
                this.container.querySelector('textarea, .CodeMirror, [data-codemirror]');

            if (editor) {

                // Track copy events within editor
                editor.addEventListener('copy', (e) => {
                    const selected = window.getSelection().toString();
                    if (selected.length > 0) {
                        this.trackCopy(selected, {
                            language: this.currentLanguage,
                            codeLength: selected.length
                        });
                    }
                });

                // Track paste events within editor
                editor.addEventListener('paste', (e) => {
                    const pastedText = e.clipboardData.getData('text/plain');
                    this.trackPaste(pastedText, {
                        language: this.currentLanguage,
                        codeLength: pastedText.length
                    });
                });
            }
        },

        /**
         * Hook into CODE_RUNNER execution button
         */
        hookIntoExecutor: function () {
            const runButton = safeQuery(this.container, '[data-action="run"], .run-btn, button:contains("Run")');
            if (runButton) {
                runButton.addEventListener('click', () => {
                    this.startExecution();
                });
            }
        },

        /**
         * Hook into CODE_RUNNER results display
         */
        hookIntoResults: function () {
            // This would need to be called after execution completes
            // with results passed in
        },

        /**
         * Track code copy in CODE_RUNNER
         */
        trackCopy: function (code, metadata = {}) {
            if (window.OCSEnhancedAnalytics) {
                window.OCSEnhancedAnalytics.recordEvent('code_copy', {
                    source: 'code_runner_editor',
                    codeLength: code.length,
                    ...metadata,
                    codePreview: code.substring(0, 100) // First 100 chars
                });
            }
            console.log('📋 Code copied in editor:', code.length, 'characters');
        },

        /**
         * Track code paste in CODE_RUNNER
         */
        trackPaste: function (code, metadata = {}) {
            if (window.OCSEnhancedAnalytics) {
                window.OCSEnhancedAnalytics.recordEvent('code_paste', {
                    source: 'code_runner_editor',
                    codeLength: code.length,
                    ...metadata
                });
            }
            console.log('📌 Code pasted in editor:', code.length, 'characters');
        },

        /**
         * Track execution start
         */
        startExecution: function () {
            this.startTime = Date.now();
            this.executionCount++;

            if (window.OCSEnhancedAnalytics) {
                window.OCSEnhancedAnalytics.recordEvent('code_execute_start', {
                    source: 'code_runner',
                    language: this.currentLanguage,
                    codeLength: this.currentCode.length,
                    executionNumber: this.executionCount
                });
            }
            console.log('▶️ Code execution started');
        },

        /**
         * Track successful execution with results
         */
        trackSuccess: function (testsPassed, totalTests, output = '') {
            const executionTime = this.startTime ? Date.now() - this.startTime : 0;
            this.successCount++;

            if (window.OCSEnhancedAnalytics) {
                window.OCSEnhancedAnalytics.recordEvent('code_execute_success', {
                    source: 'code_runner',
                    language: this.currentLanguage,
                    executionTimeMs: executionTime,
                    testsPassed: testsPassed,
                    totalTests: totalTests,
                    score: (testsPassed / totalTests) * 100,
                    outputLength: output.length
                });
            }
            console.log('✅ Execution successful:', testsPassed, '/', totalTests, 'tests passed');
        },

        /**
         * Track execution error
         */
        trackError: function (error, errorType = 'unknown') {
            const executionTime = this.startTime ? Date.now() - this.startTime : 0;
            this.errorCount++;

            if (window.OCSEnhancedAnalytics) {
                window.OCSEnhancedAnalytics.recordEvent('code_execute_error', {
                    source: 'code_runner',
                    language: this.currentLanguage,
                    executionTimeMs: executionTime,
                    errorType: errorType,
                    errorMessage: error.toString().substring(0, 200),
                    codeLength: this.currentCode.length
                });
            }
            console.log('❌ Execution error:', errorType);
        },

        /**
         * Track FRQ submission
         */
        trackFRQSubmit: function (frqMetadata = {}) {
            if (window.OCSEnhancedAnalytics) {
                window.OCSEnhancedAnalytics.recordEvent('frq_submit', {
                    source: 'code_runner',
                    language: this.currentLanguage,
                    totalExecutions: this.executionCount,
                    successfulExecutions: this.successCount,
                    errorCount: this.errorCount,
                    codeLength: this.currentCode.length,
                    ...frqMetadata
                });
            }
            console.log('🎯 FRQ submitted');
        },

    };

    // Export globally
    window.CodeRunnerAnalytics = CodeRunnerAnalytics;

    // Auto-initialize when page loads
    // Detects FRQ pages automatically - no manual setup needed
    document.addEventListener('DOMContentLoaded', function () {
        // Wait for enhanced analytics to be ready
        if (window.ENHANCED_ANALYTICS) {
            CodeRunnerAnalytics.autoInit();
        } else {
            // Retry if not ready yet
            setTimeout(() => {
                if (window.ENHANCED_ANALYTICS) {
                    CodeRunnerAnalytics.autoInit();
                }
            }, 1000);
        }
    });
})();

/* ------------------------------------------------------------------------------
 * PART 2: local fallback for the code runners. It adds one global,
 * window.__codeRunnerLocalReady, and only intercepts POSTs to /run/python,
 * /run/javascript and /run/java.
 * ------------------------------------------------------------------------------ */

(function () {
    'use strict';

    if (window.__codeRunnerLocalReady) return;
    window.__codeRunnerLocalReady = true;

    var RUN_ENDPOINT = /\/run\/(python|javascript|java)\/?$/;
    var PYODIDE_BASE = 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/';
    var BACKEND_TIMEOUT_MS = 4000;

    var backendIsDown = false;
    var pyodideReady = null;

    // ---------------------------------------------------------------- helpers

    function jsonResponse(output) {
        return new Response(JSON.stringify({ output: String(output) }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    function readCode(init) {
        try {
            if (init && typeof init.body === 'string') {
                var parsed = JSON.parse(init.body);
                if (parsed && typeof parsed.code === 'string') return parsed.code;
            }
        } catch (e) { /* fall through */ }
        return '';
    }

    function stringify(value) {
        if (typeof value === 'string') return value;
        if (value instanceof Error) return value.name + ': ' + value.message;
        try { return JSON.stringify(value); } catch (e) { return String(value); }
    }

    // ------------------------------------------------------- javascript engine

    function runJavaScript(code) {
        var logs = [];
        var saved = {
            log: console.log,
            info: console.info,
            warn: console.warn,
            error: console.error
        };

        function capture(original) {
            return function () {
                var parts = Array.prototype.map.call(arguments, stringify);
                logs.push(parts.join(' '));
                original.apply(console, arguments);
            };
        }

        console.log = capture(saved.log);
        console.info = capture(saved.info);
        console.warn = capture(saved.warn);
        console.error = capture(saved.error);

        try {
            // new Function gives each run its own scope. A plain eval would reuse the
            // caller's scope, so pressing Run twice on a cell that starts with `let`
            // would throw "Identifier has already been declared" on the second press.
            new Function(code)();
            return logs.length ? logs.join('\n') : '[no output]';
        } catch (err) {
            var prefix = logs.length ? logs.join('\n') + '\n\n' : '';
            return prefix + 'Error: ' + (err && err.message ? err.message : String(err));
        } finally {
            console.log = saved.log;
            console.info = saved.info;
            console.warn = saved.warn;
            console.error = saved.error;
        }
    }

    // ----------------------------------------------------------- python engine

    function existingPyodide() {
        // _includes/hack.html loads the same Pyodide build and keeps it in a top level
        // `let pyodide`, which lives in the global lexical scope, so it is readable by
        // name from here. Reuse it instead of downloading a second 10MB runtime.
        try {
            if (typeof pyodide !== 'undefined' && pyodide && typeof pyodide.runPythonAsync === 'function') {
                return pyodide;
            }
        } catch (e) { /* not defined on this page */ }
        return null;
    }

    function loadPyodideOnce() {
        if (pyodideReady) return pyodideReady;

        var shared = existingPyodide();
        if (shared) {
            pyodideReady = Promise.resolve(shared);
            return pyodideReady;
        }

        pyodideReady = new Promise(function (resolve, reject) {
            function boot() {
                var ready = existingPyodide();
                if (ready) { resolve(ready); return; }
                if (typeof window.loadPyodide !== 'function') {
                    reject(new Error('Pyodide loaded but loadPyodide is missing'));
                    return;
                }
                window.loadPyodide({ indexURL: PYODIDE_BASE }).then(resolve, reject);
            }

            if (typeof window.loadPyodide === 'function') { boot(); return; }

            // hack.html already puts a Pyodide tag on some pages. Wait for whichever tag
            // is present rather than adding another one.
            var existing = document.querySelector('script[data-code-runner-pyodide], script[src*="pyodide.js"]');
            if (existing) {
                existing.addEventListener('load', boot);
                existing.addEventListener('error', function () {
                    reject(new Error('Could not download Pyodide'));
                });
                return;
            }

            var tag = document.createElement('script');
            tag.src = PYODIDE_BASE + 'pyodide.js';
            tag.setAttribute('data-code-runner-pyodide', 'true');
            tag.onload = boot;
            tag.onerror = function () { reject(new Error('Could not download Pyodide')); };
            document.head.appendChild(tag);
        });

        return pyodideReady;
    }

    function runPython(code) {
        return loadPyodideOnce().then(function (py) {
            var logs = [];

            // hack.html's Run Code button leaves sys.stdout pointing at its own StringIO.
            // If this runtime is shared, put the real streams back first, otherwise
            // nothing printed here would reach setStdout below. hack.html redirects again
            // on its next run, so this does not change how hack.html behaves.
            try {
                py.runPython('import sys\nsys.stdout = sys.__stdout__\nsys.stderr = sys.__stderr__');
            } catch (e) { /* older build without __stdout__, keep going */ }

            py.setStdout({ batched: function (line) { logs.push(line); } });
            py.setStderr({ batched: function (line) { logs.push(line); } });

            return py.runPythonAsync(code).then(function () {
                return logs.length ? logs.join('\n') : '[no output]';
            }, function (err) {
                var prefix = logs.length ? logs.join('\n') + '\n\n' : '';
                var text = String((err && err.message) || err);
                // Pyodide tracebacks repeat its own internal frames. Keep the tail, which
                // is the part that names the student's mistake.
                var lines = text.split('\n').filter(function (l) { return l.trim(); });
                return prefix + lines.slice(-4).join('\n');
            });
        }, function (loadErr) {
            return 'Could not start Python in this browser.\n' + loadErr.message;
        });
    }

    // ------------------------------------------------------------- the wrapper

    var originalFetch = window.fetch.bind(window);   // the browser's own fetch, kept forever
    var downstream = originalFetch;                  // whoever else wrapped fetch, if anyone
    var ourFetch = null;
    var depth = 0;

    // Call the next fetch in the chain. If another script wrapped us and we wrapped it
    // back, the two could call each other forever, so after a couple of hops fall
    // straight through to the browser's own fetch.
    function passThrough(input, init) {
        if (depth > 2) return originalFetch(input, init);
        depth++;
        function done(v) { depth--; return v; }
        function failed(e) { depth--; throw e; }
        try {
            return Promise.resolve(downstream(input, init)).then(done, failed);
        } catch (e) {
            depth--;
            throw e;
        }
    }

    function tryBackend(input, init) {
        if (backendIsDown) return Promise.reject(new Error('backend already known to be down'));

        var controller = typeof AbortController === 'function' ? new AbortController() : null;
        var timer = controller
            ? setTimeout(function () { controller.abort(); }, BACKEND_TIMEOUT_MS)
            : null;

        var attempt = Object.assign({}, init);
        if (controller) attempt.signal = controller.signal;

        return passThrough(input, attempt).then(function (res) {
            if (timer) clearTimeout(timer);
            if (!res.ok) throw new Error('server replied ' + res.status);
            return res;
        }, function (err) {
            if (timer) clearTimeout(timer);
            backendIsDown = true;
            throw err;
        });
    }

    function methodOf(input, init) {
        if (init && init.method) return String(init.method).toUpperCase();
        try {
            if (input && input.method) return String(input.method).toUpperCase();
        } catch (e) { /* ignore */ }
        return 'GET';
    }

    function bodyOf(input, init) {
        if (init && typeof init.body === 'string') return init.body;
        try {
            if (input && typeof input.body === 'string') return input.body;
        } catch (e) { /* ignore */ }
        return '';
    }

    ourFetch = function (input, init) {
        var url = '';
        try {
            url = typeof input === 'string' ? input : (input && input.url) || '';
        } catch (e) { url = ''; }

        var match = RUN_ENDPOINT.exec(url);

        // Not a code runner call. Leave the rest of the site completely alone.
        if (!match || methodOf(input, init) !== 'POST') {
            return passThrough(input, init);
        }

        var language = match[1];

        // A browser cannot run Java. Let this behave exactly as it always has.
        if (language === 'java') {
            return passThrough(input, init);
        }

        var code = readCode({ body: bodyOf(input, init) });

        return tryBackend(input, init).then(function (res) {
            console.info('[code-runner] backend answered for ' + language);
            return res;
        }, function (err) {
            // Backend unreachable. Run it here instead and answer in the same shape the
            // backend would have used, so CodeExecutor needs no changes.
            console.info('[code-runner] backend unreachable (' +
                ((err && err.message) || err) + '), running ' + language + ' in the browser');
            if (language === 'javascript') {
                return jsonResponse(runJavaScript(code));
            }
            return runPython(code).then(jsonResponse);
        });
    };

    function install() {
        if (window.fetch === ourFetch) return;
        // Another script replaced window.fetch after us. Keep it in the chain so its work
        // still happens, and put this wrapper back on the outside for the runners.
        if (typeof window.fetch === 'function') downstream = window.fetch;
        window.fetch = ourFetch;
    }

    install();

    // Some pages assign window.fetch later (trackers, polyfills). Re-assert for a short
    // while so the runners keep their fallback without breaking anyone else's wrapper.
    var reinstallTimer = setInterval(install, 500);
    setTimeout(function () { clearInterval(reinstallTimer); }, 15000);
    window.addEventListener('DOMContentLoaded', install);
    window.addEventListener('load', install);

    console.info('[code-runner] local fallback armed. Watching POSTs to /run/python and ' +
        '/run/javascript. If a runner still fails, check window.__codeRunnerLocalReady in this console.');
})();
