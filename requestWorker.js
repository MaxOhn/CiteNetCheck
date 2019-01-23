
/*
 * Given an array of paper IDs, pass a dictionary containing key-value-pairs for each element
 * of the array mapped to an array of paper IDs that cite the element.
 *
 * @param idArray: Paper ID array that contaings elements which are being cited
 */

// Act only as worker instance for which importScripts is globally defined
if ('function' === typeof importScripts) {

    // Request to start working
    onmessage = function (event) {

        const i = event.data.i;
        const idArray = event.data.idArray;
        let xhr;

        // Dont request anything if no ids specified
        if (idArray.length == 0) {
            postMessage({ type: "end", links: {} });
            return;
        }

        // Proxy to add Access-Control-Allow-Origin parameters to server response (now redundant)
        //const corsProxy = "https://desolate-basin-70105.herokuapp.com/";

        const mainURL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi";
        let mainQueries = "dbfrom=pubmed&db=pubmed&linkname=pubmed_pubmed_citedin&retmode=json";
        console.log("[" + idArray.length + " ids] Requesting from " + mainURL + "?" + mainQueries);

        // Amount of ids is small enough to request via HTTP GET which returns json data
        if (idArray.length <= 25) {

            xhr = new XMLHttpRequest();

            // Add all ids to the query
            for (let id of idArray) {
                mainQueries += "&id=" + id;
            }

            xhr.onreadystatechange = function() {
                if (this.readyState == 4 && this.status == 200) {
                    const data = JSON.parse(this.responseText);
                    let idLinks = {};
                    if (Object.keys(data).includes("linksets")) {
                        for (let value of Object.values(data.linksets)) {
                            idLinks[value.ids] = Object.keys(value).includes("linksetdbs")
                                ? value.linksetdbs[0].links.map(l => l.toString())
                                : [];
                        }
                    }
                    postMessage({ type: "end", i: i, links: idLinks });
                }
            }
            xhr.open("GET", mainURL + "?" + mainQueries, true);
            xhr.send();
        }

        // Too many ids for GET, request by HTTP POST instead which returns data as dictionary
        else {

            // Data is requested in batches in case the amount of ids is very large
            // allLinks will contain the entire information requested from the API
            let allLinks = {};
            const waitInbetweenRequests = 750;
            const idsPerRequest = 1000;

            // Recursively called until all ids are done
            (function requestNextBatch(currIdIndex) {
                let currQueries = mainQueries;
                let n = Math.min(idArray.length, currIdIndex + idsPerRequest)
                console.log("\t-> Requesting batch from " + currIdIndex + " to " + n);

                // Request up to 'idsPerRequest' many ids, then start the next batch
                for (; currIdIndex < n; currIdIndex++) {
                    currQueries += "&id=" + idArray[currIdIndex];
                }

                // Careful to not request too much at once
                setTimeout(() => {

                    // Preapre request
                    xhr = new XMLHttpRequest();
                    xhr.onreadystatechange = function () {
                        if (this.readyState == 4 && this.status == 200) {
                            const data = JSON.parse(this.responseText);

                            // Process data
                            let currLinks = {};
                            for (let linkset of data.linksets) {
                                currLinks[linkset.ids[0]] = linkset.hasOwnProperty("linksetdbs")
                                    ? linkset.linksetdbs[0].links.map(l => l.toString())
                                    : [];
                            }

                            // Add new data to allLinks
                            const allKeys = Object.keys(allLinks);
                            for (let key in currLinks) {
                                if (key in allKeys)
                                    allLinks[key] += currLinks[key];
                                else
                                    allLinks[key] = currLinks[key];
                            }

                            // If all ids done, use callback, otherwise continue recursively
                            if (currIdIndex < idArray.length)
                                requestNextBatch(currIdIndex);
                            else {
                                postMessage({ type: "end", i: i, links: allLinks });
                            }
                        }
                    }
                    xhr.open("POST", mainURL, true);
                    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
                    xhr.send(currQueries);
                }, waitInbetweenRequests);
            })(0);
        }
    };
}