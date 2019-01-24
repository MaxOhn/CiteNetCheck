
/*
 * Return a dicitonary containing values with respect to the input variable "network"
 *  avgClust:    Average cluster coefficient
 *  minClust:    Minimal local cluster coefficient
 *  maxClust:    Maximal local cluster coefficient
 *  minDeg:      Minimal degree of nodes
 *  maxDeg:      Maximal degree of nodes
 *  nNodes:      Amount of nodes
 *
 * @param network: Dictionary of the network (key node maps to array of nodes)
 */

// Act only as worker instance for which importScripts is globally defined
if ('function' === typeof importScripts) {
    importScripts("dependencies/jsnetworkx.min.js");

    // Request to start working
    onmessage = function (event) {
        let network = event.data.network;

        // Reformulate edges into arrays of 2 elements
        let edges = Object.keys(network).reduce((allEdges, currKey) => {
            return allEdges.concat(network[currKey].map(elem => {
                return [currKey, elem];
            }));
        }, []);

        // Create graph via JSNetworkX library
        let graph = new jsnx.Graph();
        graph.addNodesFrom(Object.keys(network));
        graph.addEdgesFrom(edges);

        // Dictionary containing local clusterings of each node
        let localClustering = jsnx.clustering(graph)._stringValues;

        // Dictionary containing betweenness centrality of each node
        // Too heavy to compute for large networks, hence disabled
        //let betweenness = jsnx.betweennessCentrality(graph)._stringValues;

        // Calculate the rest of the info and return it
        let prop =
        {
            avgClust: round(jsnx.averageClustering(graph), 2),
            minClust: round(Object.values(localClustering).reduce((min, elem) => elem < min ? elem : min, 0), 2),
            maxClust: round(Object.values(localClustering).reduce((max, elem) => elem > max ? elem : max, 0), 2),
            minDeg: Object.values(network).reduce((min, elem) => elem.length < min ? elem.length : min, 0),
            maxDeg: Object.values(network).reduce((max, elem) => elem.length > max ? elem.length : max, 0),
            nNodes: Object.keys(network).length
        };

        // Return the resulting properties
        postMessage({ type: "end", properties: prop });
    };

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
}