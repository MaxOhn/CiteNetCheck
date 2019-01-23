
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

// Act only as worker instance for which importScripts is globally defined
if ('function' === typeof importScripts) {
    importScripts("dependencies/d3/d3.min.js");

    // Request to start working
    onmessage = function (event) {
        let network = event.data.network;

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
        let prop =
        {
            globalClust: round(addedClustering / Object.keys(localClustering).length, 2),
            minClust: Object.values(localClustering).reduce((min, elem) => elem < min ? elem : min),
            maxClust: Object.values(localClustering).reduce((max, elem) => elem > max ? elem : max),
            minDeg: Object.values(network).reduce((min, elem) => elem.length < min ? elem.length : min, 0),
            maxDeg: Object.values(network).reduce((max, elem) => elem.length > max ? elem.length : max, 0),
            nNodes: allNodes.length
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