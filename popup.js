
/*
 * Global variables for repeated use
 */
// Dictionary containing all links, i.e. all the info for the drawing part
let citedinDict = {};
let maxCitedinDict = {};

// Keeps track which nodes were added at which depth
let depthNodesAdded = {};

// Keeps track about the network's properties for each depth
let depthNetworkInfo = {};

// How many degrees of distant neighbors should be retrieved
// depth = 2 means up to all neighbors of 2nd degree of the initial paper ID
let depth = 2;

// Background worker to make all the API requests
let requestWorker = new Worker("requestWorker.js");

// Background worker to calculate properties like clustering or degrees of the network
let networkPropertiesWorker = new Worker("networkPropertiesWorker.js");

// Instance responsible for the network itself, both logically and visually
let drawing;

// Instance responsible for displaying current loading progress
let loading;

/*
 * Executed when the extension page is ready after clicking the icon
 */
$(document).ready(() => {

    // Start loading screen
    startLoadingScreen();
    loading = new LoadingProgress();
    loading.start(depth);

    // Add functions to buttons
    d3.select("#creditsButton")
        .on("click", toggleCredits);
    d3.select("#depthUpdateButton")
        .on("click", updateDepth);

    // Auxiliary function to draw elements above other elements
    d3.selection.prototype.moveToFront = function () {
        return this.each(function () {
            this.parentNode.appendChild(this);
        });
    };

    // Instance responsible for the network itself, both logically and visually
    drawing = new NetworkDrawing();

    // Handle requestWorker responses i.e. draw elements but hide them and
    // either keep recursion running or finish the drawing
    requestWorker.onmessage = event => {
        switch (event.data.type) {
            case "batchEnd":
                loading.setBatchProgress(event.data.progress);
                drawing.addElements(event.data.batchDict);
                break;
            case "end":
                loading.requestDone();
                drawing.addElements(event.data.batchDict);
                dataRetrieved(event.data.links, event.data.i);
                break;
        }
    };

    // Handle networkPropertiesWorker responses i.e. draw info about the network (clustering & degrees)
    networkPropertiesWorker.onmessage = event => {
        switch (event.data.type) {
            case "end":
                depthNetworkInfo[depth] = event.data.properties;
                drawLegend(event.data.properties);
                break;
        }
    };

    //*
    // Retrieve original paper ID from current webpage's url
    getCurrentPaperID(id => {

        // At depth 0, only the original paper id is added
        depthNodesAdded[0] = [id];

        // Recursive function called once for every iteration of depth
        // The timeout (sometime) prevents the first request to be done twice for some reason
        setTimeout(() => getCitedinForNextPapers(depth), 1000);
    });
    //*/
});

/*
 * First waits for the delay between requests, then starts a job for the requestWorker
 *
 * @param i: Amount of recursions left
 */
function getCitedinForNextPapers(i) {

    // 3 requests per second are allowed, let's not overdo it
    const waitPerIteration = 750;

    // Wait inbetween requests
    setTimeout(() => {

        // Start worker
        requestWorker.postMessage({
            i: i,
            idArray: (depth - i) in depthNodesAdded ? depthNodesAdded[depth - i] : []
        });
    }, waitPerIteration);
}

/*
 * Keeps requesting for the next depth layer until the desired depth is reached
 *
 * @nextCitedinDict: Dictionary of nodes that were added in the last depth iteration
 * @param i: Amount of recursions left
 */
function dataRetrieved(nextCitedinDict, i) {

    // Check which id's neighbors need to be retrieved next
    // Includes IDs introduced in the last iteration minus the ones already considered
    depthNodesAdded[depth - i + 1] = Object.values(nextCitedinDict)
        .reduce((concatenation, curr) => concatenation.concat(curr), [])
        .filter(id => !Object.keys(citedinDict).includes(id));

    // Add result to the main dictionary
    for (let key in nextCitedinDict) {
        citedinDict[key] = nextCitedinDict[key];
    }

    // Desired depth not yet reached, stay in recursion
    if (--i) getCitedinForNextPapers(i);

    // Depth reached, finish recursion
    else {

        // Add "no links" to leaf nodes
        extendDict();

        // Information was gained, save it permanently
        updateMaxValues();

        // Start drawing the network
        drawing.finalDraw();
    }
}

/*
 * Extend citedinDict by indicating "no entry = no links"
 */
function extendDict() {
    for (let valueArray of Object.values(citedinDict)) {
        for (let value of valueArray) {
            if (!citedinDict.hasOwnProperty(value)) {
                citedinDict[value] = [];
            }
        }
    }
}

/*
 * Save all information permanently in case e.g. the currently used dict becomes smaller
 * and later on extended again.
 */
function updateMaxValues() {
    if (Object.keys(citedinDict).length > Object.keys(maxCitedinDict).length)
        for (let key in citedinDict)
            maxCitedinDict[key] = citedinDict[key];
}

/*
 * Toggle the div element displaying credits information
 */
function toggleCredits() {
    let creditsContainer = d3.select("#creditsContainer");
    if (creditsContainer.style("visibility") == "hidden") {
        creditsContainer.styles({
            transition: "visibility .5s, opacity .5s",
            visibility: "visible",
            opacity: 1
        });
    } else {
        creditsContainer.styles({
            transition: "visibility .5s, opacity .5s",
            visibility: "hidden",
            opacity: 0
        });
    }
}

/*
 * Restarts the thread of networkPropertiesWorker.js in case it is running
 */
function npWorkerRestart() {

    networkPropertiesWorker.terminate();
    networkPropertiesWorker = new Worker("networkPropertiesWorker.js");

    // Handle networkPropertiesWorker responses i.e. draw info about the network (clustering & degrees)
    networkPropertiesWorker.onmessage = event => {
        switch (event.data.type) {
            case "end":
                depthNetworkInfo[depth] = event.data.properties;
                drawLegend(event.data.properties);
                break;
        }
    };
}

/*
 * Depending on how depth was changed, request more data or modify current dictionary entries
 * and redraw network
 */
function updateDepth() {

    npWorkerRestart();

    // Get input element value
    let newDepth = parseInt(d3.select("#depthInput")
        .property("value"));

    // Delete previous drawing and start loading
    removeCanvasContent();
    startLoadingScreen();

    let maxDepth = Object.keys(depthNodesAdded).length - 1;

    // If newDepth is larger than the current max, retrieve additional data and draw
    if (newDepth > maxDepth) {
        for (let key in maxCitedinDict) {
            citedinDict[key] = maxCitedinDict[key];
        }
        depth = newDepth;
        loading.start(depth - maxDepth);
        let asyncPromise = new Promise(resolve => resolve(getCitedinForNextPapers(newDepth - maxDepth)));
        asyncPromise.then(_ => updateMaxValues());
    } else {

        // If newDepth is smaller than current depth, remove some nodes
        if (depth > newDepth) {

            for (let i = newDepth; i < maxDepth + 1; i++) {
                if (!(i in depthNodesAdded))
                    continue;
                for (let savedID of depthNodesAdded[i]) {
                    delete citedinDict[savedID];
                }
            }
        }

        // If newDepth is greater than depth but smaller than the max, copy data from previous max
        else {
            for (let i = depth; i < newDepth; i++) {
                for (let savedID of depthNodesAdded[i]) {
                    citedinDict[savedID] = maxCitedinDict[savedID];
                }
            }
        }

        // Add "no links" to leaf nodes
        extendDict();

        // Save new depth and start drawing
        depth = newDepth;
        drawing.drawPreviousDepth();
    }
}

/*
 * Draw loading animation and keep updating loading text
 */
function startLoadingScreen() {
    let svg = d3.select("#svgCanvas");

    // Hide the input div
    d3.select("#depthInputDiv")
        .styles({
            visibility: "hidden"
        })

    // Loading animation
    svg.append("image")
        .attrs({
            id: "loading-animation",
            href: "images/loading-animation.svg",
            x: getCanvasWidth() / 2 - "Preparing data".length * 7 / 2,
            y: getCanvasHeight() / 2 - 70,
            width: 80,
            height: 80
        });

    // Loading text
    let loadingText = svg.append("text")
        .attrs({
            id: "loading-text",
            x: getCanvasWidth() / 2 - "Preparing data (..%)".length * 15 / 2,
            y: getCanvasHeight() / 2 + 70
        })
        .text("Preparing data (0%)");
}

/*
 * Responsible for displaying the current loading progress
 *
 * Public variable: totalRequests
 * Callable methods:
 *   - setBatchProgress(p)
 *   - setMovementProgress(p)
 *   - requestDone()
 *   - reset()
 */
function LoadingProgress() {

    // Auxiliary variable for rounding purposes
    const precision = Math.pow(10, 2);

    // Loading is split in 2 parts, both worth 50%: Requesting and calculating movement
    // Requesting further depends on the progress of all batches required
    let requestProgress;
    let currentRequests;
    let totalRequests;
    let batchProgress;
    let movementProgress;
    let progress;

    // Update by changing batch progress
    this.setBatchProgress = p => {
        batchProgress = p;
        update(this.totalRequests);
    }

    // Update by changing movement progress
    this.setMovementProgress = p => {
        movementProgress = p;
        update();
    }

    // Update by changing request progress
    this.requestDone = () => {
        batchProgress = 0;
        requestProgress = ++currentRequests / totalRequests;
        update();
    }

    // Initialize progress variables
    this.start = tRequests => {
        requestProgress = 0;
        currentRequests = 0;
        totalRequests = tRequests;
        batchProgress = 0;
        movementProgress = 0;
    }

    // Update final progress and rewrite loading text
    function update() {
        progress = 50 * Math.round((requestProgress + (batchProgress / totalRequests) + movementProgress) * precision) / precision;
        d3.select("#loading-text")
            .text("Preparing data (" + progress + "%)");
    }
}

/*
 * Removing loading screen elements and show input elements
 */
function stopLoadingScreen() {
    d3.select("#loading-animation").remove();
    d3.select("#loading-text").remove();
    d3.select("#depthInputDiv")
        .styles({
            visibility: "visible"
        });
}

/*
 * Global function to return SVG canvas width
 */
function getCanvasWidth() {
    return Math.round(d3.select("#svgCanvas").style("width").replace("px", ""));
}

/*
 * Global function to return SVG canvas height
 */
function getCanvasHeight() {
    return Math.round(d3.select("#svgCanvas").style("height").replace("px", ""));
}

/*
 * Remove all object in the canvas i.e. nodes, links, side info
 */
function removeCanvasContent() {
    d3.selectAll(".node").remove();
    d3.selectAll(".link").remove();
    d3.select("#infoDisplay").remove();
}

/*
 * Responsible for all movements in the network and the drawing of the network
 *
 * Callable methods:
 *   - addElements(elementDict)
 *   - finalDraw()
 *   - drawPreviousDepth()
 */
function NetworkDrawing() {

    const svg = d3.select("#networkCanvas");

    // For up to this amount of nodes the node movement will be much smoother
    const heavyCalcNodeAmount = 500;

    // Array containing all currently considered paperIDs
    let allIDs = [];

    // nodes is an array containing objects of the form {x: a, y: b, paperID: c}
    // a and b are random with respect to the window size
    // c is the paperID as a string
    let nodes = [];

    // links is an array containing elements of the form {source: a, target: b}
    // a is a paper in nodes that was cited by paper b in nodes
    let links = [];

    // Logical simulation of node and link movements
    let force;

    // Auxiliary variables to trigger paperID label and node expansion
    let dragging = false;
    let hover = false;
    let movingLinksSource = [];
    let movingLinksTarget = [];

    // Responsible for mouse zoom and background drag
    const zoom = d3.zoom()
        .scaleExtent([0, 4])
        .on("zoom", zoomed);

    // Responsible for node drag
    const drag = d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);

    /*
     * To split up the workload over time, this function allows to pre-calculate
     * all nodes and links and also pre-draws the links but hides them
     *
     * @param elementDict: Dictionary of all elements to be added. Keys are
     *                     paperID strings that are cited by all paperID strings
     *                     in the corresponding value which is in array
     */
    this.addElements = elementDict => {

        // Stop movement of potential previous drawing
        if (force != null) force.stop();

        // Parse the new elements
        let newKeys = Object.keys(elementDict);
        let newValues = Object.values(elementDict)
            .reduce((concatenation, curr) => concatenation.concat(curr), []);

        // Concatenate all elements in newKeys and newValues to allIDs
        // and add a corresponding object to nodes
        allIDs = [newKeys, newValues]
            .reduce((concatenation, currArray) => {
                let indices = Object.create(null);
                currArray.forEach(elem => {
                    let p = concatenation.indexOf(elem, indices[elem] || 0);
                    if (indices[elem] = p === -1) {

                        // Found new element
                        concatenation.push(elem);
                        nodes.push(
                            {
                                x: Math.random() * getCanvasWidth(),
                                y: Math.random() * getCanvasHeight(),
                                paperID: elem
                            });
                    } else p + 1;
                });
                return concatenation;
            }, allIDs)

        // Calculate links between nodes
        links = newKeys.reduce((currLinks, currKey) => {
            return currLinks.concat(elementDict[currKey]
                .map(citedinID => {
                    return {
                        source: nodes.find(n => n.paperID == currKey),
                        target: nodes.find(n => n.paperID == citedinID.toString())
                    };
                })
            );
        }, links);

        // Draw the links but hide them
        svg.selectAll(".link").data(links)
            .enter()
            .append("line")
            .attrs({
                class: d => "link s" + d.source.paperID + " t" + d.target.paperID,
                x1: d => d.source.x,
                y1: d => d.source.y,
                x2: d => d.target.x,
                y2: d => d.target.y
            })
            .styles({
                stroke: "black",
                "stroke-width": 0.8,
                visibility: "hidden"
            });

        svg.selectAll(".node").data(nodes)
            .enter()
            .append("circle")
            .attrs({
                class: "node",
                r: 3,
                cx: d => d.x,
                cy: d => d.y
            })
            .styles({
                "background-color": "black",
                visibility: "hidden"
            });
    }

    /*
     * Function to start calculating force's influence on element positions,
     * visual node creation and listeners to nodes and canvas such as dragging
     */
    this.finalDraw = () => {

        // Add zoom but disable double-click zoom
        d3.select("#svgCanvas")
            .call(zoom)
            .on("dblclick.zoom", null);

        // Background worker to simulate force after the initial random positions of nodes
        let initialWorker = new Worker("initialWorker.js");

        // Handle worker responses
        initialWorker.onmessage = event => {
            switch (event.data.type) {
                case "tick":
                    loading.setMovementProgress(event.data.progress);
                    break;
                case "end":
                    initialWorkerEnded(event.data, false);
                    break;
            }
        };

        // Start worker
        initialWorker.postMessage({
            quality: nodes.length < heavyCalcNodeAmount ? "high" : "low",
            nodes: nodes,
            links: links
        });
    }

    this.drawPreviousDepth = () => {

        // nodes now only depends on citeinDict
        nodes = Object.keys(citedinDict).map(key => {
            return {
                x: Math.random() * getCanvasWidth(),
                y: Math.random() * getCanvasHeight(),
                paperID: key.toString()
            }
        });

        // Consider only the currently present links
        links = Object.keys(citedinDict).reduce((currLinks, currKey) => {
            return currLinks.concat(citedinDict[currKey]
                .map(citedinID => {
                    return {
                        source: nodes.find(n => n.paperID == currKey),
                        target: nodes.find(n => n.paperID == citedinID.toString())
                    };
                })
            );
        }, []);

        // Background worker to simulate force after the initial random positions of nodes
        let initialWorker = new Worker("initialWorker.js");

        // Handle worker responses
        initialWorker.onmessage = event => {
            switch (event.data.type) {
                case "tick":
                    loading.setMovementProgress(event.data.progress);
                    break;
                case "end":
                    initialWorkerEnded(event.data, true);
                    break;
            }
        };

        // Start worker
        initialWorker.postMessage({
            quality: nodes.length < heavyCalcNodeAmount ? "high" : "low",
            nodes: nodes,
            links: links
        });
    }

    // Positions of nodes and links calculated, start drawing
    function initialWorkerEnded(data, drawLinks) {

        nodes = data.nodes;
        links = data.links;

        // Force if amount of nodes is low enough to make calculation feasable
        if (nodes.length < heavyCalcNodeAmount) {
            force = d3.forceSimulation(nodes)
                .force("tick", tick)
                .force("x", d3.forceX(700 / 2).strength(0.1))
                .force("y", d3.forceY(500 / 2).strength(0.1))
                .force("charge", d3.forceManyBody().strength(-40))
                .force("link", d3.forceLink(links).distance(50).strength(0.2));
        }

        stopLoadingScreen();

        // Visual arrow head template
        svg.append("marker")
            .attrs({
                id: "arrow",
                orient: "auto",
                refX: "8",
                refY: "3",
                markerWidth: "10",
                markerHeight: "6"
            })
            .append("path")
            .attr("d", "M0,0 L5,3 L0,6");

        // Visual link data
        if (drawLinks) {

            // Links still need to be drawn
            svg.selectAll(".link")
                .data(links)
                .enter()
                .append("line")
                .attrs({
                    class: d => "link s" + d.source.paperID + " t" + d.target.paperID,
                    x1: d => d.source.x,
                    y1: d => d.source.y,
                    x2: d => d.target.x,
                    y2: d => d.target.y
                })
                .styles({
                    stroke: "black",
                    "stroke-width": 0.8
                });
        }

        // All links have been drawn and only need to be replaced
        else {
            svg.selectAll(".link")
                .data(links)
                .attrs({
                    x1: d => d.source.x,
                    y1: d => d.source.y,
                    x2: d => d.target.x,
                    y2: d => d.target.y
                })
                .styles({
                    "marker-end": "url(#arrow)",
                    visibility: "visible"
                });
        }

        // Visual node data
        svg.selectAll(".node")
            .data(nodes)
            .enter()
            .append("circle")
            .attrs({
                class: "node",
                r: 3,
                cx: d => d.x,
                cy: d => d.y
            })
            .styles({
                "background-color": "black"
            });

        // Make them visible and add mouse and drag behaviour
        svg.selectAll(".node")
            .data(nodes)
            .attrs({
                cx: d => d.x,
                cy: d => d.y
            })
            .styles({
                visibility: "visible"
            })
            .on("mouseover", handleMouseOver)
            .on("mouseout", handleMouseOut)
            .call(drag);

        // Mark node of initial paper
        svg.select(".node")
            .styles({
                fill: "red",
                stroke: "black",
                "stroke-width": 1
            });

        // Properties have been calculated before
        if (depth in depthNetworkInfo)
            drawLegend(depthNetworkInfo[depth])

        // No properties for current depth calculated yet
        else {

            // Start worker
            networkPropertiesWorker.postMessage({
                network: citedinDict
            });
        }
    }

    // Visual node and link movement for each tick
    function tick() {
        svg.selectAll(".node")
            .attrs({
                cx: d => d.x,
                cy: d => d.y
            });

        svg.selectAll(".link")
            .attrs({
                x1: d => d.source.x,
                y1: d => d.source.y,
                x2: d => d.target.x,
                y2: d => d.target.y
            });
    };

    // Restarts the force between the nodes upon mouse press on a node
    function dragstarted(d) {
        dragging = true;
        if (!d3.event.active && nodes.length < heavyCalcNodeAmount)
            force.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
        d3.event.sourceEvent.stopPropagation();
        movingLinksSource = d3.selectAll(".s" + d.paperID);
        movingLinksTarget = d3.selectAll(".t" + d.paperID);
    }

    // Triggered each tick while a node is pressed, moves the node and its paper ID text
    function dragged(d, i) {
        d.fx = d3.event.x;
        d.fy = d3.event.y;
        d3.select("#t" + d.paperID + "-" + i)
            .attrs({
                x: d.x - d.paperID.length * 11 / 2,
                y: d.y - 15
            });
        d3.select(this)
            .attrs({
                cx: d.x = d3.event.x,
                cy: d.y = d3.event.y
            });

        // Move adjacent links
        movingLinksSource.attrs({
            x1: _ => d.x,
            y1: _ => d.y
        })
        movingLinksTarget.attrs({
            x2: _ => d.x,
            y2: _ => d.y
        })
    }

    // Triggered upon mouse release on a node, determines force end and removes paper ID
    function dragended(d) {
        dragging = false;
        if (!d3.event.active && nodes.length < heavyCalcNodeAmount)
            force.alphaTarget(0);
        d.fx = null;
        d.fy = null;
        if (!hover)
            d3.selectAll(".labelPaperId").remove();

        // Delete selection
        movingLinksSource = d3.select();
        movingLinksTarget = d3.select();
    }

    // Enlargens the node upon hovering and displays the node's paper ID
    function handleMouseOver(d, i) {
        if (dragging) return;
        hover = true;
        d3.select(this).moveToFront();
        d3.select(this)
            .transition()
            .duration(100)
            .attr("r", 10)
            .styles({
                fill: () => d.paperID == depthNodesAdded[0][0] ? "red" : "white",
                stroke: "black",
                "stroke-width": 3
            })
            .on("end", () => {
                if (d3.select("#t" + d.paperID + "-" + i).size() == 0) {
                    svg.append("text")
                        .attrs({
                            class: "labelPaperId",
                            id: "t" + d.paperID + "-" + i
                        })
                        .text(d.paperID);
                }
                d3.select("#t" + d.paperID + "-" + i)
                    .attrs({
                        x: d.x - d.paperID.length * 11 / 2,
                        y: d.y - 15
                    });
            });
    }

    // Shrinks the node again and removes the paper ID
    function handleMouseOut(d) {
        if (dragging) return;
        hover = false;
        d3.select(this)
            .transition()
            .duration(100)
            .attr("r", 3)
            .styles({
                fill: () => d.paperID == depthNodesAdded[0][0] ? "red" : "black",
                stroke: "black",
                "stroke-width": 1
            });
        if (!dragging)
            d3.selectAll(".labelPaperId").remove();
    }

    // MouseWheel zoom and canvas movement by dragging
    function zoomed() {
        svg.attr(
            "transform", "translate(" + d3.event.transform.x + "," + d3.event.transform.y + ")scale(" + d3.event.transform.k + ")"
        );
    }

}

/*
 * Get current tab, read its url, extract paper ID from it and pass it to callback
 *
 * @param callback: Function to be called upon data retrieval
 */
function getCurrentPaperID(callback) {
    chrome.tabs.query({
        active: true,
        lastFocusedWindow: true
    }, tabs => callback(tabs[0].url.split("/pubmed/").pop()));
}

/*
 * Adds info about the network in the upper left corner of the SVG
 * This info includes everything returned from the networkProperties worker
 *
 * @param networkInfo:  Dictionary containing info like clustering coefficients
 *                      or degrees of the network (data returned from the worker)
 */
function drawLegend(networkInfo) {

    // Save properties
    depthNetworkInfo[depth] = networkInfo;

    d3.select("#svgCanvas")
        .append("g")
        .attr("id", "infoDisplay")
        .selectAll(".infoDisplay")
        .data([
            { t: "# nodes", num: networkInfo.nNodes },
            { t: "Min Degree", num: networkInfo.minDeg },
            { t: "Max Degree", num: networkInfo.maxDeg },
            { t: "Avg CC", num: networkInfo.avgClust },
            { t: "Min LCC", num: networkInfo.minClust },
            { t: "Max LCC", num: networkInfo.maxClust }
        ])
        .enter()
        .append("text")
        .attrs({
            class: "infoDisplay",
            x: 10,
            y: (_, i) => 15 * (i + 1)
        })
        .text(d => d.t + ": " + d.num);
}