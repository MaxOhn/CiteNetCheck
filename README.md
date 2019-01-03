# CiteNetCheck



CiteNetCheck is a browser extension written within the scope of my "Studienarbeit" at the [mHealth division](https://www.ukaachen.de/kliniken-institute/institut-fuer-medizinische-informatik/research/mhealth.html) of RWTH Aachen Uniklinik during the winter term 18/19.

This extension retrieves data from [pubmed](https://www.ncbi.nlm.nih.gov/pubmed) of a papers local citation network and displays the network and some of its properties.

Preview: 

![Preview](https://puu.sh/Cr6Rv/2440428731.gif)

# Usage



Once imported as browser extension, the extensions icon will lit up on pubmeds websites for papers, e.g.

 [Critical evaluation of the Newcastle-Ottawa scale for the assessment of the quality of nonrandomized studies in meta-analyses.](https://www.ncbi.nlm.nih.gov/pubmed/20652370)

or

[The use of postoperative topical corticosteroids in chronic rhinosinusitis with nasal polyps: a systematic review and meta-analysis.](https://www.ncbi.nlm.nih.gov/pubmed/24119596)

Once the icon is clicked, a small window will open, first retrieving data about the citation network, and then displaying it.



# TODOs



- As of now, all data is requested from [NCBI's E-Utilities API](https://www.ncbi.nlm.nih.gov/books/NBK25497/). Unfortunately, the APIs interface requires a new request for each papers citations so if a paper was cited many times, the extension will have to request many times.
The current workaround is to throttle down to 1 request per second for up to 10-50 papers that cite the original paper and work with the resulting sub-network.
- For now, the extension was tested solely on Google Chrome Windows 10.


# Dependencies / Credits



- [d3](https://d3js.org/)
- [jQuery](https://jquery.com/)
- Extension icons are made by [Smashicons](https://www.flaticon.com/authors/smashicons), licensed as [Creative Commons BY 3.0](http://creativecommons.org/licenses/by/3.0/)