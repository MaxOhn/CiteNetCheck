
// Act only as worker instance for which importScripts is globally defined
if ('function' === typeof importScripts) {
    importScripts("dependencies/d3/d3.min.js");

    // Request to start working
    onmessage = function (event) {
        let quality = event.data.quality;
        let nodes = event.data.nodes;
        let links = event.data.links;

        // Setup node and link movement
        let force = d3.forceSimulation(nodes)
            .force("x", d3.forceX(700 / 2).strength(0.1))
            .force("y", d3.forceY(500 / 2).strength(0.1))
            .force("charge", d3.forceManyBody().strength(-40));

        if (quality == "low") {
            force.force("link", d3.forceLink(links).distance(100).strength(0.1).iterations(10))
                .stop();
        } else {
            force.force("link", d3.forceLink(links).distance(50).strength(0.2));
        }

        // Calculate ticks of node and link movement
        const n = Math.ceil(Math.log(force.alphaMin()) / (10 * Math.log(1 - force.alphaDecay())));
        for (let i = 0; i < n; ++i) {
            force.tick();
        }

        // Return the result of the movement
        postMessage({ type: "end", nodes: nodes, links: links });
        close();
    };
}