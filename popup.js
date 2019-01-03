
/*
 * Executed once the extension page is ready after clicking the icon
 */
$(document).ready(() => {

    // Prepares the visual window
    prepareSVG();

    getCurrentPaperID(id => {
        getCitedinIDs(id, citedinArray => {

            // Contains promise object for each asynchronous request
            let operations = [];

            // Pick at most 10 cited-in papers
            const iterations = Math.min(citedinArray.length, 10);

            // Wait inbetween requests
            const waitPerIteration = 1000;

            // Requests data asynchronously
            (function getCitedinForNextPaper(i) {
                setTimeout(() => {
                    operations.push(new Promise(resolve => {
                        getCitedinIDs(citedinArray[i], nextCitedinArray => {
                            let outDict = {};
                            outDict[citedinArray[i]] = nextCitedinArray;
                            for (let citedinPaper of nextCitedinArray) {
                                outDict[citedinPaper] = [];
                            }
                            resolve(outDict);
                        });
                    }));
                    console.log("iteration " + i);
                    if (--i) getCitedinForNextPaper(i);
                }, waitPerIteration)
            })(iterations);

            // Wait until everything is requested
            setTimeout(() => {
                Promise.all(operations).then(d => {

                    // If all data is present, put it into the dictionary citedinDict
                    let citedinDict = {};
                    citedinDict[id] = citedinArray.slice(0, iterations);
                    for (let dict of d) {
                        for (let key in dict) {
                            citedinDict[key] = key in citedinDict
                                ? citedinDict[key].concat(dict[key])
                                : citedinDict[key] = dict[key];
                        }
                    }
                    //console.log("citedinDict:");
                    //console.log(citedinDict);
                    draw(citedinDict);
                });
            }, iterations * waitPerIteration + 1000)
        });
    });
});

/*
 *  Add the HTML element containing everything, preset its size, orientation, and border
 */
function prepareSVG() {

    // First add the containing div, then save the included SVG canvas as a variable
    let svg = d3.select("body")
        .append("div")
        .attr("id", "container")
        .styles({
            width: "100%",
            height: "100%"
        })
        .append("svg")
        .attrs({
            id: "networkCanvas",
            width: "100%",
            height: "100%"
        })
        .styles({
            border: "3px solid black",
            margin: "auto"
        });

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
        })
        .styles({
            "font-size": "30px"
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
 * Global function to return SVG canvas width
 */
function getCanvasWidth() {
    return Math.round(d3.select("#networkCanvas").style("width").replace("px", ""));
}

/*
 * Global function to return SVG canvas height
 */
function getCanvasHeight() {
    return Math.round(d3.select("#networkCanvas").style("height").replace("px", ""));
}

/*
 *  Draw the network
 *  @param citeDict: Dictionary where keys are IDs of papers and values are arrays of IDs of papers which cite their key paper
 */
function draw(citeDict) {

    // Remove elements of the loading screen
    d3.select("#loading-animation").remove();
    d3.select("#loading-text").remove();

    const svg = d3.select("#networkCanvas");

    const widthNetwork = getCanvasWidth();
    const heightNetwork = getCanvasHeight();

    let node = svg.selectAll(".node");
    let link = svg.selectAll(".link");

    // nodes is an array containing objects of the form {x: a, y: b, paperID: c}
    // a and b are random with respect to the window size
    // c is the paperID as a string
    let nodes = Object.keys(citeDict).map(key => {
        return {
            x: Math.random() * getCanvasWidth(),
            y: Math.random() * getCanvasHeight(),
            paperID: key.toString()
        }
    });

    // links is an array containing elements of the form {source: a, target: b}
    // a is a paper in nodes that was cited by paper b in nodes
    let links = Object.keys(citeDict).reduce((currLinks, currKey) => {
        return currLinks.concat(citeDict[currKey]
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
        .force("link", d3.forceLink(links).distance(40).strength(0.1))
        .force("charge", d3.forceManyBody().strength(-70));

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
        .attr("d", "M0,0 L5,3 L0,6")
        .styles({
            stroke: "black",
            fill: "none",
            "stroke-width": "1",
        });

    // Visual link data
    link = link.data(links)
        .enter()
        .append("line")
        .attr("class", "link")
        .styles({
            stroke: "black",
            "stroke-width": 1,
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
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended)
    );

    // Marker node of initial paper
    node.filter((d, i) => i == 0)
        .styles({
            fill: "red",
            stroke: "black",
            "stroke-width": 1
        });

    // Auxiliary variable to trigger paperID label
    let dragging = false;

    // Enlargens the node upon hovering and displays the node's paper ID
    function handleMouseOver(d, i) {
        d3.select(this)
            .transition()
            .duration(100)
            .attr("r", 10)
            .styles({
                fill: () => d.paperID == Object.keys(citeDict)[0] ? "red" : "white",
                stroke: "black",
                "stroke-width": 3
            })
            .on("end", () => {
                if (d3.select("#t" + d.paperID + "-" + i).size() == 0) {
                    svg.append("text")
                        .attr("id", "t" + d.paperID + "-" + i)
                        .style("font-weight", "bold")
                        .text(d.paperID);
                }
                d3.select("#t" + d.paperID + "-" + i)
                    .attrs({
                        x: d.x - d.paperID.length * 7 / 2,
                        y: d.y - 15
                    });
            });
    }

    // Shrinks the node again and removes the paper ID
    function handleMouseOut(d, i) {
        d3.select(this)
            .transition()
            .duration(100)
            .attr("r", 3)
            .styles({
                fill: () => d.paperID == Object.keys(citeDict)[0] ? "red" : "black",
                stroke: "black",
                "stroke-width": 1
            });
        if (!dragging) {
            d3.select("#t" + d.paperID + "-" + i).remove();
        }
    }

    // Restarts the force between the nodes upon mouse press on a node
    function dragstarted(d) {
        dragging = true;
        if (!d3.event.active)
            force.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    // Triggered each tick while a node is pressed, moves the node and its paper ID text
    function dragged(d, i) {
        d.fx = d3.event.x;
        d.fy = d3.event.y;
        d3.select("#t" + d.paperID + "-" + i)
            .attrs({
                x: d.x - d.paperID.length * 7 / 2,
                y: d.y - 15
            });
    }

    // Triggered upon mouse release on a node, determines force end and removes paper ID
    function dragended(d, i) {
        dragging = false;
        if (!d3.event.active)
            force.alphaTarget(0);
        d.fx = null;
        d.fy = null;
        d3.select("#t" + d.paperID + "-" + i).remove();
    }

    // Draw info about the network (clustering & degrees)
    drawLegend(citeDict);
}

/*
 * Get current tab, read its url, extract paper ID from it and pass it to callback
 * @param callback: Function to be called upon data retrieval
 */
function getCurrentPaperID(callback) {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, tabs => callback(tabs[0].url.split("/pubmed/").pop()));
}

/*
 * Given a paper's ID, pass an array containing all IDs of paper that cite the original paper to the callback function
 * @param originID: Paper ID that is being cited
 * @param callback: Function to be called upon data retrieval
 */
function getCitedinIDs(originID, callback) {
    const mainURL = "http://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi";
    const queries = "dbfrom=pubmed&db=pubmed&linkname=pubmed_pubmed_citedin&retmode=json&id=";

    $.getJSON(mainURL + "?" + queries + originID, data => {

        // Check if JSON object has the necessary attributes
        if (Object.keys(data).includes("linksets")
            && Object.keys(data.linksets[0]).includes("linksetdbs")
            && Object.keys(data.linksets[0].linksetdbs[0]).includes("links")) {

            callback(data.linksets[0].linksetdbs[0].links.map(id => id.toString()));     // callback with array of IDs

        // JSON object does not contain "cited-in" IDs
        } else {
            callback([]);
        }
    });
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
        globalClust: addedClustering / Object.keys(localClustering).length,
        minClust: Object.values(localClustering).reduce((min, elem) => elem < min ? elem : min),
        maxClust: Object.values(localClustering).reduce((max, elem) => elem > max ? elem : max),
        minDeg: Object.values(network).reduce((min, elem) => elem.length < min ? elem.length : min, 0),
        maxDeg: Object.values(network).reduce((max, elem) => elem.length > max ? elem.length : max, 0)
    };
}

/*
 * Adds info about the network in the upper left corner of the SVG
 * This info includes everything returned from the calculateNetworkInfo function
 * @param network: Dictionary of the network (key node maps to array of nodes)
 */
function drawLegend(network) {

    // Dictionary containing info like clustering coefficients or degrees of the network
    const networkInfo = calculateNetworkInfo(network);

    d3.select("#networkCanvas")
        .selectAll(".infoDispplay")
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
            class: "infoDispplay",
            x: 10,
            y: (_, i) => 15 * (i + 1)
        })
        .styles({
            "font-family": "sans-serif",
            "font-size": "11px"
        })
        .text(d => d.t + ": " + d.num);
}

/*
 * Auxiliary function to round number
 * @param num: Number to be rounded
 * @param precision: Decimal places to be taken into account
 */
function round(num, precision) {
    precision = Math.pow(10, precision);
    return Math.round(num * precision) / precision;
}