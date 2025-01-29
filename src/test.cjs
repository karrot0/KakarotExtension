"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createChapterRequest = createChapterRequest;
const { create } = require("domain");
var base_1 = require("./utils/url-builder/base.cjs");
const cheerio = require('cheerio');
function createChapterRequest(baseUrl, mangaId) {
    var request = {
        url: new base_1.URLBuilder(baseUrl)
            .addPath("read")
            .addPath(mangaId)
            .addPath("en")
            .addPath("chapter-15")
            .build(),
        method: "GET",
        headers: {
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "accept-language": "en-US,en;q=0.9",
            "cache-control": "max-age=0",
            "sec-ch-ua": '"Chromium";v="130", "Opera GX";v="115", "Not?A_Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate", 
            "sec-fetch-site": "same-origin",
            "sec-fetch-user": "?1",
            "upgrade-insecure-requests": "1",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0"
        },
    };
    console.log('Request:', request);

    // Make the actual HTTP request
    fetch(request.url, {
        method: request.method,
        headers: request.headers
    })
    .then(response => response.text())
    .then(html => {
        const $ = cheerio.load(html);
        const pages = $('img').map((i, el) => $(el).attr('src')).get();
        console.log('Image URLs:', pages);
        //console.log('Response HTML:', html);
        //const $ = cheerio.load(html);
        //const pages = $('img').map((_, img) => $(img).attr('src')).get();
        //console.log('Pages:', pages);
        //return pages;
    })
    .catch(error => console.error('Error:', error));

    return request;
}

createChapterRequest('https://mangafire.to', 'the-regressed-genius-players-legendary-weapon-creation.5wrz9')