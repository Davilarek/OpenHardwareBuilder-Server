const USE_HTTPS = false;
const key = USE_HTTPS ? require("fs").readFileSync('./CA/localhost/localhost.decrypted.key') : undefined;
const cert = USE_HTTPS ? require("fs").readFileSync('./CA/localhost/localhost.crt') : undefined;
// change for your needs

const http = USE_HTTPS ? require('https') : require('http');
// const pdfParse = require("pdf-parse")
const { PdfData, VerbosityLevel } = require("pdfdataextract")

const port = process.env.PORT || 7778;

const JUST_PROXY = false;

function isValidHttpUrl(string) {
    let url;
    try {
        url = new URL(string);
    }
    catch (_) {
        return false;
    }
    return url.protocol === "http:" || url.protocol === "https:";
}

/**
 * 
 * @param {http.IncomingMessage} request 
 * @param {http.ServerResponse} response 
 */
const requestHandler = (request, response) => {
    // response.end('Hello Node.js Server!');
    console.log("got request");
    const url = new URL(request.url, `http://${request.headers.host}`);
    response.setHeader("Access-Control-Allow-Origin", "*");
    // console.log(url);
    if (url.pathname == "/get" && url.searchParams.has("url") && url.searchParams.get("url") != "") {
        // response.end("test " + url.searchParams.get("url"));
        if (!isValidHttpUrl(url.searchParams.get("url"))) {
            response.end("NOT OK");
            return;
        }
        if (JUST_PROXY) {
            adapterFor(url.searchParams.get("url")).get(url.searchParams.get("url"), (res) => {
                // set encoding so we get strings instead of byte streams
                // res.setEncoding('utf8');

                res.on('data', (data) => {
                    // console.log(data);
                    response.write(data);
                });

                res.on("end", () => {
                    response.end();
                });

                // if there's an error, log it out
                res.on('error', (e) => {
                    console.log(`Got error: ${e.message}`);
                });
            });
        }
        else {
            let finalData;
            let chunks = [];
            adapterFor(url.searchParams.get("url")).get(url.searchParams.get("url"), (/**@type {http.IncomingMessage} */res) => {
                const contentType = res.headers['content-type'];
                if (contentType != "application/pdf") {
                    res.destroy();
                    response.end("NOT OK");
                    return;
                }
                res.on('data', (data) => {
                    // console.log(data);
                    // response.write(data);
                    // finalData += data;
                    chunks.push(data);
                });

                res.on("end", () => {
                    // response.end();
                    // console.log(finalData);
                    finalData = Buffer.concat(chunks);
                    // pdfParse(finalData).then(function (data) {
                    //     // number of pages
                    //     // console.log(data.numpages);
                    //     // number of rendered pages
                    //     // console.log(data.numrender);
                    //     // PDF info
                    //     // console.log(data.info);
                    //     // PDF metadata
                    //     // console.log(data.metadata);
                    //     // PDF.js version
                    //     // check https://mozilla.github.io/pdf.js/getting_started/
                    //     // console.log(data.version);
                    //     // PDF text
                    //     // console.log(data.text);

                    // });
                    PdfData.extract(finalData, {
                        verbosity: VerbosityLevel.ERRORS, // set the verbosity level for parsing
                    }).then((data) => {
                        // data.pages; // the number of pages
                        // data.text; // an array of text pages
                        // response.end(preparePDF(data.text).join("\n\n<NEXT PAGE>\n\n").replace(/[^\w\s]/gi, ''));
                        // response.write("");
                        response.setHeader("Content-Type", "text/plain");
                        response.end(preparePDF(data.text).join("\n\n<NEXT PAGE>\n\n").replace(/[^a-zA-Z0-9.,\s]/g, ''));
                    });
                });

                // if there's an error, log it out
                res.on('error', (e) => {
                    console.log(`Got error: ${e.message}`);
                });
            });
        }
    }
    // TODO: fix this long line, this is quick and dirty solution
    else if (url.pathname == "/search" && url.searchParams.has("productBrand") && url.searchParams.get("productBrand") != "" && url.searchParams.has("productName") && url.searchParams.get("productName") != "") {
        const productName = url.searchParams.get("productName");
        // const baseURL = "https://rog.asus.com/recent-data/search-api/v1/suggestion_v1/pl/product/10?SearchKey=" + productName.replaceAll(" ", "-") + "&systemCode=rog";
        const productBrand = url.searchParams.get("productBrand");
        const i = url.searchParams.has("i") && url.searchParams.get("i") != "" ? url.searchParams.get("i") : 0;
        switch (productBrand) {
            case "ASUS":
                findASUSSupportUrl(productName, i, (data) => {
                    response.setHeader("Content-Type", "text/plain");
                    response.end(data);
                });
                break;
            case "ASUS_ROG":
                findASUS_ROGSupportUrl(productName, i, (data) => {
                    response.setHeader("Content-Type", "text/plain");
                    response.end(data);
                });
                break;
            default:
                response.end("OK");
                break;
        }
    }
    else if (url.pathname == "/getPDF" && url.searchParams.has("url") && url.searchParams.get("url") != "") {
        const urlParam = url.searchParams.get("url");
        if (urlParam.startsWith("https://rog.asus.com")) {
            // url: https://rog.asus.com/support/webapi/product/GetPDManual?website=pl&model=ROG-STRIX-X670E-E-GAMING-WIFI&pdid=20994&mode=&LevelTagId=204970&country=&region=&systemCode=rog
            //      https://rog.asus.com/support/webapi/product/GetPDManual?website=pl&model=rog-strix-x670e-e-gaming-wifi&systemCode=rog
            ///                                                                              rog-strix-x670e-e-gaming-wifi-model
            // example:                       https://rog.asus.com/pl/motherboards/rog-strix/rog-strix-x670e-e-gaming-wifi-model/
            const baseURL = "https://rog.asus.com/support/webapi/product/GetPDManual?website=global&model=" + urlParam.split("/")[urlParam.split("/").length - 2].split("-model")[0] + "&pdid=20994&mode=&LevelTagId=204970&country=&region=&systemCode=rog";

            simpleGET(baseURL, (final) => {
                const availableManuals = JSON.parse(final).Result.Obj[0].Files;
                const parsed = availableManuals.filter(x => x.Title.endsWith("( English Edition )") && x.Title.includes("User"))[0].DownloadUrl.Global.replaceAll(" ", "%20") + "helpdesk_manual/";
                response.setHeader("Content-Type", "text/plain");
                response.end(parsed);
            });
        }
        else if (urlParam.startsWith("https://www.asus.com")) {
            // url: https://www.asus.com/support/api/product.asmx/GetPDManual?website=global&model=Pro-WS-WRX80E-SAGE-SE-WIFI-II&pdhashedid=tvn5bjd8hnpzzhyy&pdid=&region=&country=&siteID=www&sitelang=
            // const baseURL = "https://www.asus.com/support/api/product.asmx/GetPDManual?website=global&model=" + urlParam.split("/")[urlParam.split("/").length - 2].split("-model")[0] + "&pdhashedid=tvn5bjd8hnpzzhyy&pdid=&region=&country=&siteID=www&sitelang=";
            const baseURL = "https://www.asus.com/support/api/product.asmx/GetPDManual?website=global&model=" + urlParam.split("/")[urlParam.split("/").length - 2].split("-model")[0] + "&pdhashedid=&pdid=99999&region=&country=&siteID=www&sitelang=";

            simpleGET(baseURL, (final) => {
                const availableManuals = JSON.parse(final).Result.Obj[0].Files;
                // const parsed = availableManuals.filter(x => x.Title.endsWith("( English Edition )") && x.Title.includes("User"))[0].DownloadUrl.Global.replaceAll(" ", "%20") + "helpdesk_manual/";
                const parsed = availableManuals.filter(x => (x.Title.endsWith("( English Edition )") || x.Title.endsWith("(English)")) && x.Title.includes("User"))[0].DownloadUrl.Global.replaceAll(" ", "%20") + "helpdesk_manual/";
                response.setHeader("Content-Type", "text/plain");
                response.end(parsed);
            });
        }
    }
    else {
        response.end("OK");
    }
};

/**
 * rog link: https://rog.asus.com/recent-data/search-api/v1/suggestion_v1/pl/product/10?SearchKey=ROG-STRIX-X670E-E-GAMING-WIFI&systemCode=rog
 * @param {string} productName
 */
function findASUS_ROGSupportUrl(productName, i, cb) {
    const baseURL = "https://rog.asus.com/recent-data/search-api/v1/suggestion_v1/pl/product/10?SearchKey=" + productName.replaceAll(" ", "-") + "&systemCode=rog";
    try {
        simpleGET(baseURL, (/**@type {Buffer} */data) => {
            try {
                const parsed = JSON.parse(data.toString("utf-8")).Result.Obj[0].Items[i].Url.replaceAll(" ", "%20") + "helpdesk_manual";
                cb(parsed);
            } catch (error) {
                cb("NOT OK");
            }
        });
    } catch (error) {
        cb("NOT OK");
    }
    // const parsed = JSON.parse(data.toString("utf-8")).Result.List[i].ProductManualUrl.replaceAll(" ", "%20").slice(0, -1);
}

/**
 * ASUS LINK: https://www.asus.com/pl/searchresult?searchType=support&searchKey=<DATA>&page=1
 * more data: https://odinapi.asus.com/recent-data/apiv2/SearchResult?SystemCode=asus&WebsiteCode=pl&SearchKey=b150+pro+gaming+aura&SearchType=support&SearchPDLine=&SearchPDLine2=&PDLineFilter=&TopicFilter=&CateFilter=&PageSize=10&Pages=1&LocalFlag=0&siteID=www&sitelang=
 * @param {string} productName
 */
function findASUSSupportUrl(productName, i, cb) {
    const baseURL = "https://odinapi.asus.com/recent-data/apiv2/SearchResult?SystemCode=asus&WebsiteCode=pl&SearchKey=" + productName.replaceAll(" ", "+") + "&SearchType=support&SearchPDLine=&SearchPDLine2=&PDLineFilter=&TopicFilter=&CateFilter=&PageSize=10&Pages=1&LocalFlag=0&siteID=www&sitelang=";
    try {
        simpleGET(baseURL, (/**@type {Buffer} */data) => {
            try {
                const parsed = JSON.parse(data.toString("utf-8")).Result.List[i].ProductManualUrl.replaceAll(" ", "%20").slice(0, -1);
                cb(parsed);
            } catch (error) {
                cb("NOT OK");
            }
        });
    } catch (error) {
        cb("NOT OK");
    }
    // return parsed;
}

function addReplaceAll() {
    /**
     * String.prototype.replaceAll() polyfill
     * https://gomakethings.com/how-to-replace-a-section-of-a-string-with-another-one-with-vanilla-js/
     * @author Chris Ferdinandi
     * @license MIT
     */
    if (!String.prototype.replaceAll) {
        String.prototype.replaceAll = function (str, newStr) {

            // If a regex pattern
            if (Object.prototype.toString.call(str).toLowerCase() === '[object regexp]') {
                return this.replace(str, newStr);
            }

            // If a string
            return this.replace(new RegExp(str, 'g'), newStr);

        };
    }
}

function simpleGET(url, cb) {
    let finalData;
    let chunks = [];
    adapterFor(url).get(url, (/**@type {http.IncomingMessage} */res) => {
        res.on('data', (data) => {
            chunks.push(data);
        });

        res.on("end", () => {
            finalData = Buffer.concat(chunks);
            cb(finalData);
        });

        // if there's an error, log it out
        res.on('error', (e) => {
            console.log(`Got error: ${e.message}`);
        });
    });
}

/**
 * 
 * @param {Array<string>} pages 
 */
function preparePDF(pages) {
    const searchFor = ["specifications summary", "specs", "specifications \nsummary"];
    const mustHave = "CPU";
    const mustNotHave = "Chapter";
    const results = [];
    for (let index = 0; index < pages.length; index++) {
        const element = pages[index];
        const result = searchFor.some(word => element.includes(word) && element.includes(mustHave) && !element.includes(mustNotHave));
        // console.log(result);
        results.push(result);
    }

    return pages.filter(x => results[pages.indexOf(x)] === true);
}

// function render_page(pageData) {
//     let render_options = {
//         normalizeWhitespace: false,
//         disableCombineTextItems: false
//     }

//     return pageData.getTextContent(render_options)
//         .then(function (textContent) {
//             let lastY, text = '';
//             for (let item of textContent.items) {
//                 if (lastY == item.transform[5] || !lastY) {
//                     text += item.str;
//                 }
//                 else {
//                     text += '\n' + item.str;
//                 }
//                 lastY = item.transform[5];
//             }
//             return text;
//         });
// }

// let options = {
//     pagerender: render_page
// }

const adapterFor = (function () {
    let url = require('url'),
        adapters = {
            'http:': require('http'),
            'https:': require('https'),
        };

    return function (inputUrl) {
        return adapters[url.parse(inputUrl).protocol]
    }
}());

const server = USE_HTTPS ? http.createServer({ key, cert }, requestHandler) : http.createServer(requestHandler);

addReplaceAll();

server.listen(port, (err) => {
    if (err) {
        return console.log('something bad happened', err) //handle errors here 
    }

    console.log(`server is listening on ${port}`) //log when server is listening 
});