# CiteNetCheck



CiteNetCheck is a browser extension written within the scope of my "Studienarbeit" at the [mHealth division](https://mhealth.imib.rwth-aachen.de/) of the RWTH Aachen Uniklinik during the winter term 18/19.

This extension retrieves data from [pubmed](https://www.ncbi.nlm.nih.gov/pubmed) of a paper's local citation network and displays the network and some of its properties.

Preview: 

![Preview](https://puu.sh/CBQD9/20deecddda.gif)

# Usage



Once imported as browser extension, the extension's icon will lit up on pubmed's websites for papers, e.g.

 [Critical evaluation of the Newcastle-Ottawa scale for the assessment of the quality of nonrandomized studies in meta-analyses.](https://www.ncbi.nlm.nih.gov/pubmed/20652370)

or

[The use of postoperative topical corticosteroids in chronic rhinosinusitis with nasal polyps: a systematic review and meta-analysis.](https://www.ncbi.nlm.nih.gov/pubmed/24119596)

Once the icon is clicked, a small window will open, first retrieving data about the citation network, and then displaying it.



# TODOs



- None as of now


# Dependencies / Credits



- DOM manipulation: [jQuery](https://jquery.com/)
- Network visualization: [d3](https://d3js.org/)
- Property calculation: [JSNetworkX](http://jsnetworkx.org/index.html)
- Data retrieval: [NCBI's E-Utilities API](https://www.ncbi.nlm.nih.gov/books/NBK25497/) ([Disclaimer and Copyright notice](https://www.ncbi.nlm.nih.gov/home/about/policies/))
- Extension icons are made by [Smashicons](https://www.flaticon.com/authors/smashicons), licensed as [Creative Commons BY 3.0](https://creativecommons.org/licenses/by/3.0/legalcode)