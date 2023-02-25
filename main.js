const http = require('http');
// const pdfParse = require("pdf-parse")
const { PdfData, VerbosityLevel } = require("pdfdataextract")

const port = 7778;

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
    // response.end('Hello Node.js Server!')
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
    else {
        response.end("OK");
    }
};

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

const server = http.createServer(requestHandler);

server.listen(port, (err) => {
    if (err) {
        return console.log('something bad happened', err) //handle errors here 
    }

    console.log(`server is listening on ${port}`) //log when server is listening 
});