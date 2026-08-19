---
layout: post
title: About ME
permalink: /about/
comments: true
---

## As a conversation Starter

Here are some places I have lived.

<comment>
Flags are made using Wikipedia images
</comment>

<style>
    /* Style looks pretty compact, 
       - grid-container and grid-item are referenced the code 
    */
    .grid-container {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); /* Dynamic columns */
        gap: 10px;
    }
    .grid-item {
        text-align: center;
    }
    .grid-item img {
        width: 100%;
        height: 100px; /* Fixed height for uniformity */
        object-fit: contain; /* Ensure the image fits within the fixed height */
    }
    .grid-item p {
        margin: 5px 0; /* Add some margin for spacing */
    }

    .image-gallery {
        display: flex;
        flex-wrap: nowrap;
        overflow-x: auto;
        gap: 10px;
        }

    .image-gallery img {
        max-height: 150px;
        object-fit: cover;
        border-radius: 5px;
    }
</style>

<!-- This grid_container class is used by CSS styling and the id is used by JavaScript connection -->
<div class="grid-container" id="grid_container">
    <!-- content will be added here by JavaScript -->
</div>

<script>
    // 1. Make a connection to the HTML container defined in the HTML div
    var container = document.getElementById("grid_container"); // This container connects to the HTML div

    // 2. Define a JavaScript object for our http source and our data rows for the Living in the World grid
    var http_source = "https://upload.wikimedia.org/wikipedia/commons/";
    var living_in_the_world = [
        {"flag": "0/01/Flag_of_California.svg", "greeting": "Hey", "description": "California - forever"},
        {"flag": "https://cdn11.bigcommerce.com/s-w6fxwapwzi/images/stencil/1280w/products/2646/5509/2x3-india-flag-image__89215.1582736189.jpg", "greeting": "Namaste", "description": "India - 10 years"},
    ];

    // 3a. Consider how to update style count for size of container
    // The grid-template-columns has been defined as dynamic with auto-fill and minmax

    // 3b. Build grid items inside of our container for each row of data
    for (const location of living_in_the_world) {
        // Create a "div" with "class grid-item" for each row
        var gridItem = document.createElement("div");
        gridItem.className = "grid-item";  // This class name connects the gridItem to the CSS style elements
        // Add "img" HTML tag for the flag
        var img = document.createElement("img");
        img.src = http_source + location.flag; // concatenate the source and flag
        img.alt = location.flag + " Flag"; // add alt text for accessibility

        // Add "p" HTML tag for the description
        var description = document.createElement("p");
        description.textContent = location.description; // extract the description

        // Add "p" HTML tag for the greeting
        var greeting = document.createElement("p");
        greeting.textContent = location.greeting;  // extract the greeting

        // Append img and p HTML tags to the grid item DIV
        gridItem.appendChild(img);
        gridItem.appendChild(description);
        gridItem.appendChild(greeting);

        // Append the grid item DIV to the container DIV
        container.appendChild(gridItem);
    }
</script>

### Journey through Life

Here is what I did at those places

- 🏫 Elemantry school was done In India (Private) Search it up it's Greenwood in Banglore
- 🏫 Middle school at Oak Valley
- 🎓 Currently in Highschool Del Norte class of 29

### Culture, Family, and Fun

Everything for me, as for many others, revolves around family and faith.

- My Background is Pretty Straighforward, I am 100% Indian and You can tell that by looking at my parents and grandparents.
- My Family is what you call the Strong Base, we have 3 people living in the house Me,My mom and My Dad for which i am very grateful for. Soon my Grandpa will come live with us
- The gallery of pics has some of my family, fun, culture and faith memories.

<comment>
Gallery of Pics, scroll to the right for more ...
</comment>
<div class="image-gallery">
  <img src="{{site.baseurl}}/images/about/IMG_2327.PNG" alt="Image 1">
  <img src="{{site.baseurl}}/images/about/6186cdc3-bac4-40f7-abd3-790d59576d53.jpg" alt="Image 2">
  <img src="{{site.baseurl}}/images/about/677b5227-5f3f-4968-ad46-4fb5f0153928.jpg" alt="Image 3">
  <img src="{{site.baseurl}}/images/about/d0222888-8b0b-41c9-8874-75088b3cd7e1.jpg" alt="Image 4">
  <img src="{{site.baseurl}}/images/about/IMG_7070.HEIC" alt="Image 5">
  <img src="{{site.baseurl}}/images/about/IMG_0639.HEIC" alt="Image 6">
</div>
