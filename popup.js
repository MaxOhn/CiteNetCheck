
/*
 * Global variables for repeated use
 */
// Dictionary containing all links, i.e. all the info for the drawing part
let citedinDict = {};
let maxCitedinDict = {};

// Keeps track which nodes were added at which depth
let depthNodesAdded = {};

// How many degrees of distant neighbors should be retrieved
// depth = 2 means up to all neighbors of 2nd degree of the initial paper ID
let depth = 2;

/*
 * Executed once the extension page is ready after clicking the icon
 */
$(document).ready(() => {

    // Start loading screen
    startLoadingScreen();

    // Add functions to buttons
    d3.select("#creditsButton")
        .on("click", toggleCredits);
    d3.select("#depthUpdateButton")
        .on("click", updateDepth);

    ///*
    // Retrieve original paper ID from current webpage's url
    getCurrentPaperID(id => {

        // At depth 0, only the original paper id is added
        depthNodesAdded[0] = [id];

        // Recursive function called once for every iteration of depth
        getCitedinForNextPapers(depth);
    });
    //*/
});

/*
 * Keeps requesting for the next depth layer until the desired depth is reached
 *
 * @param i: Amount of recursions left
 */
function getCitedinForNextPapers(i) {

    // 3 requests per second are allowed, let's not overdo it
    const waitPerIteration = 750;

    // Wait inbetween requests
    setTimeout(() => {

        // Retrieve the neighboring paper IDs
        getCitedinIDs(depthNodesAdded[depth - i], nextCitedinDict => {

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
                draw();
            }
        });
    }, waitPerIteration);
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
 * Depending on how depth was changed, request more data or modify current dictionary entries
 * and redraw network
 */
function updateDepth() {

    // Get input element value
    let newDepth = parseInt(d3.select("#depthInput")
        .property("value"));

    // Delete previous drawing
    removeCanvasContent();

    let maxDepth = Object.keys(depthNodesAdded).length - 1;

    // If newDepth is larger than the current max, retrieve additional data and draw
    if (newDepth > maxDepth) {
        startLoadingScreen();
        for (let key in maxCitedinDict) {
            citedinDict[key] = maxCitedinDict[key];
        }
        depth = newDepth;
        let asyncPromise = new Promise(resolve => resolve(getCitedinForNextPapers(newDepth - maxDepth)));
        asyncPromise.then(_ => updateMaxValues());
    } else {

        // If newDepth is smaller than current depth, remove some nodes
        if (depth > newDepth) {
            for (let i = newDepth; i < maxDepth + 1; i++) {
                for (let savedID of depthNodesAdded[i]) {
                    delete citedinDict[savedID];
                }
            }

        // If newDepth is greater than depth but smaller than the max, copy data from previous max
        } else {
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
        draw();
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
            x: getCanvasWidth() / 2 - "Retrieving data".length * 7 / 2,
            y: getCanvasHeight() / 2 - 70,
            height: 80
        });

    // Loading text
    let loadingText = svg.append("text")
        .attrs({
            id: "loading-text",
            x: getCanvasWidth() / 2 - "Retrieving data".length * 15 / 2,
            y: getCanvasHeight() / 2 + 70
        });

    // Update text every 500ms
    loadingText.transition()
        .on("start", function repeat() {
            d3.active(this).text("Retrieving data")
                .transition().delay(500).text("Retrieving data.")
                .transition().delay(500).text("Retrieving data..")
                .transition().delay(500).text("Retrieving data...")
                .transition().delay(500).on("start", repeat);
        });
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
 * Draw the network
 *
 * @param citeDict: Dictionary where keys are IDs of papers and values are arrays of IDs of papers which cite their key paper
 */
function draw() {

    stopLoadingScreen();

    const svg = d3.select("#networkCanvas");
    const widthNetwork = getCanvasWidth();
    const heightNetwork = getCanvasHeight();

    const zoom = d3.zoom()
        .scaleExtent([1, 4])
        .on("zoom", zoomed);

    // Add zoom but disable double-click zoom
    d3.select("#svgCanvas").call(zoom)
        .on("dblclick.zoom", null);

    const drag = d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);

    let node = svg.selectAll(".node");
    let link = svg.selectAll(".link");

    // nodes is an array containing objects of the form {x: a, y: b, paperID: c}
    // a and b are random with respect to the window size
    // c is the paperID as a string
    let nodes = Object.keys(citedinDict).map(key => {
        return {
            x: Math.random() * getCanvasWidth(),
            y: Math.random() * getCanvasHeight(),
            paperID: key.toString()
        }
    });

    // links is an array containing elements of the form {source: a, target: b}
    // a is a paper in nodes that was cited by paper b in nodes
    let links = Object.keys(citedinDict).reduce((currLinks, currKey) => {
        return currLinks.concat(citedinDict[currKey]
            .map(citedinID => {
                return {
                    source: nodes.find(n => n.paperID == currKey),
                    target: nodes.find(n => n.paperID == citedinID.toString())
                };
            })
        );
    }, []);

    // Visual node and link movement for each tick
    const tick = () => {
        node.attrs({
            cx: d => d.x,
            cy: d => d.y
        });

        link.attrs({
            x1: d => d.source.x,
            y1: d => d.source.y,
            x2: d => d.target.x,
            y2: d => d.target.y
        });
    };

    // Logical node and link movement
    let force = d3.forceSimulation(nodes)
        .force("tick", tick)
        .force("x", d3.forceX(widthNetwork / 2).strength(0.1))
        .force("y", d3.forceY(heightNetwork / 2).strength(0.1))
        .force("link", d3.forceLink(links).distance(50).strength(0.2))
        .force("charge", d3.forceManyBody().strength(-40))
        ;

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
    link = link.data(links)
        .enter()
        .append("line")
        .attr("class", "link")
        .styles({
            stroke: "black",
            "stroke-width": 0.8,
            "marker-end": "url(#arrow)"
        });

    // Visual node data
    node = node.data(nodes)
        .enter()
        .append("circle")
        .attrs({
            class: "node",
            r: 3
        })
        .style("background-color", "black")
        .on("mouseover", handleMouseOver)
        .on("mouseout", handleMouseOut)
        .call(drag);

    // Mark node of initial paper
    node.filter((_, i) => i == 0)
        .styles({
            fill: "red",
            stroke: "black",
            "stroke-width": 1
        });

    // MouseWheel zoom and canvas movement by dragging
    function zoomed() {
        svg.attr(
            "transform", "translate(" + d3.event.transform.x + "," + d3.event.transform.y + ")scale(" + d3.event.transform.k + ")"
        );
    }

    // Auxiliary variables to trigger paperID label
    let hover = false;
    let dragging = false;

    // Enlargens the node upon hovering and displays the node's paper ID
    function handleMouseOver(d, i) {
        hover = true;
        d3.select(this)
            .transition()
            .duration(100)
            .attr("r", 10)
            .styles({
                fill: () => d.paperID == Object.keys(citedinDict)[0] ? "red" : "white",
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
        hover = false;
        d3.select(this)
            .transition()
            .duration(100)
            .attr("r", 3)
            .styles({
                fill: () => d.paperID == Object.keys(citedinDict)[0] ? "red" : "black",
                stroke: "black",
                "stroke-width": 1
            });
        if (!dragging)
            d3.selectAll(".labelPaperId").remove();
    }

    // Restarts the force between the nodes upon mouse press on a node
    function dragstarted(d) {
        dragging = true;
        if (!d3.event.active)
            force.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
        d3.event.sourceEvent.stopPropagation();
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
    }

    // Triggered upon mouse release on a node, determines force end and removes paper ID
    function dragended(d) {
        dragging = false;
        if (!d3.event.active)
            force.alphaTarget(0);
        d.fx = null;
        d.fy = null;
        if (!hover)
            d3.selectAll(".labelPaperId").remove();
    }

    // Draw info about the network (clustering & degrees)
    drawLegend(citedinDict);
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
 * Given an array of paper IDs, pass a dictionary containing key-value-pairs for each element
 * of the array mapped to an array of paper IDs that cite the element.
 *
 * @param idArray: Paper ID array that contaings elements which are being cited
 * @param callback: Function to be called upon data retrieval
 */
function getCitedinIDs(idArray, callback) {

    // Dont request anything if no ids specified
    if (idArray.length == 0) {
        callback({});
        return;
    }

    // Proxy to add Access-Control-Allow-Origin parameters to server response (now redundant)
    //const corsProxy = "https://desolate-basin-70105.herokuapp.com/";

    const mainURL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi";
    let queries = "dbfrom=pubmed&db=pubmed&linkname=pubmed_pubmed_citedin&retmode=json";

    let counter = 0;

    // Add all ids to the query
    for (let id of idArray) {
        queries += "&id=" + id;
        if (counter++ > 250)
            break;
    }
    console.log("Requesting from " + mainURL + "?" + queries);

    // Amount of ids is small enough to request via HTTP GET which returns json data
    if (idArray.length <= 25) {

        // Request data, process it, call callback with processed data
        $.getJSON(mainURL + "?" + queries, data => {
            let idLinks = {};
            if (Object.keys(data).includes("linksets")) {
                for (let value of Object.values(data.linksets)) {
                    idLinks[value.ids] = Object.keys(value).includes("linksetdbs")
                        ? value.linksetdbs[0].links.map(l => l.toString())
                        : [];
                }
            }
            callback(idLinks);
        });
    }

    // Too many ids for GET, request by HTTP POST instead which returns data as dictionary
    else {

        // Request data, process it, call callback with processed data
        $.post({
            url: mainURL,
            proccessData: false,
            data: queries,
            success: data => {
                let idLinks = {};
                for (let linkset of data.linksets) {
                    idLinks[linkset.ids[0]] = linkset.hasOwnProperty("linksetdbs")
                        ? linkset.linksetdbs[0].links.map(l => l.toString())
                        : [];
                }
                callback(idLinks);
            }
        });
    }
}

/*
 * Return a dicitonary containing values with respect to the input variable "network"
 *  globalClust: Global cluster coefficient
 *  minClust:    Minimal local cluster coefficient
 *  maxClust:    Maximal local cluster coefficient
 *  minDeg:      Minimal degree of nodes
 *  maxDeg:      Maximal degree of nodes
 *
 * @param network: Dictionary of the network (key node maps to array of nodes)
 */
function calculateNetworkInfo(network) {

    // Concatenation of all reachable nodes
    let allValues = Object.values(network).reduce((union, curr) => union.concat(curr), []);

    // Array of all nodes
    let allNodes = Object.keys(network).concat(allValues).filter((val, ind, self) => self.indexOf(val) == ind);

    // Dictionary that maps nodes to indices of the adjacency matrix
    let nodeMap = {};

    // Preparing adjacency matrix
    let adjMatrix = [];

    // Add a row for each node
    for (let i = 0; i < allNodes.length; i++) {

        // Check for all nodes if they are reached from the current node or not and push 1 or 0, respectively
        let newRow = allNodes.map(elem => network[allNodes[i]].indexOf(elem) != -1 ? 1 : 0);

        // Add the row and save the index
        adjMatrix.push(newRow);
        nodeMap[i] = allNodes[i];
    }

    // Make the matrix symmetrix i.e. if (x,y) is a one then (y,x) must be a one too
    adjMatrix.forEach((row, x) => {
        row.forEach((cell, y) => {
            if (cell == 1) {
                adjMatrix[y][x] = 1;
            }
        });
    });

    // Dictionary containing local clusterings of each node
    let localClustering = {};

    // For each node i
    for (let i = 0; i < allNodes.length; i++) {

        // Get all neighbors
        let neighbors = adjMatrix[i].map((elem, ind) => elem == 1 ? ind : -1).filter(elem => elem != -1);

        let divisor = neighbors.length * (neighbors.length - 1);
        let sum = 0;

        // For each neighbor n
        for (let n of neighbors) {

            // Get all neighbors
            let nneighbors = adjMatrix[n].map((elem, ind) => elem == 1 ? ind : -1).filter(elem => elem != -1);

            // Add the amount of common neighbors node i and n
            sum += neighbors.filter(elem => nneighbors.indexOf(elem) != -1).length;
        }

        // Divide by coefficient divisor and save
        localClustering[nodeMap[i]] = divisor == 0 ? 0 : sum / divisor;
    }

    // Take average of local cluster coefficients as global cluster coefficient
    let addedClustering = (Object.values(localClustering).reduce((sum, elem) => sum + elem));

    // Calculate the rest of the info and return it
    return {
        globalClust: round(addedClustering / Object.keys(localClustering).length, 2),
        minClust: Object.values(localClustering).reduce((min, elem) => elem < min ? elem : min),
        maxClust: Object.values(localClustering).reduce((max, elem) => elem > max ? elem : max),
        minDeg: Object.values(network).reduce((min, elem) => elem.length < min ? elem.length : min, 0),
        maxDeg: Object.values(network).reduce((max, elem) => elem.length > max ? elem.length : max, 0)
    };
}

/*
 * Adds info about the network in the upper left corner of the SVG
 * This info includes everything returned from the calculateNetworkInfo function
 *
 * @param network: Dictionary of the network (key node maps to array of nodes)
 */
function drawLegend(network) {

    // Dictionary containing info like clustering coefficients or degrees of the network
    const networkInfo = calculateNetworkInfo(network);

    d3.select("#svgCanvas")
        .append("g")
        .attr("id", "infoDisplay")
        .selectAll(".infoDisplay")
        .data([
            { t: "Min Degree", num: networkInfo.minDeg },
            { t: "Max Degree", num: networkInfo.maxDeg },
            { t: "GCC", num: networkInfo.globalClust },
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

/*
 * Auxiliary function to round number
 *
 * @param num: Number to be rounded
 * @param precision: Decimal places to be taken into account
 */
function round(num, precision) {
    precision = Math.pow(10, precision);
    return Math.round(num * precision) / precision;
}