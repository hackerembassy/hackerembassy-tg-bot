const config = require("config");
const embassyApiConfig = config.get("embassy-api");
const { default: fetch } = require("node-fetch");

class Cancellation {
    constructor(timeout = 15000) {
        this.controller = new AbortController();
        this.timeoutId = setTimeout(() => this.controller.abort(), timeout);
    }

    get signal() {
        return this.controller.signal;
    }

    reset() {
        clearTimeout(this.timeoutId);
    }
}

/**
 * @param {string} uri
 * @param {object} options
 * @param {any[]} rest
 */
function fetchWithTimeout(uri, options, ...rest) {
    let cancellation = new Cancellation(options?.timeout ?? embassyApiConfig.timeout);

    // @ts-ignore
    return fetch(uri, { signal: cancellation.signal, ...options }, ...rest);
}

/**
 * @param {string} url
 * @returns {Promise<Response>}
 */
async function getFromHass(url) {
    // @ts-ignore
    return await fetch(`${url}`, {
        headers: {
            Authorization: `Bearer ${process.env["HASSTOKEN"]}`,
            "Content-Type": "application/json",
        },
    });
}

/**
 * @param {string} url
 * @param {any} body
 * @returns {Promise<Response>}
 */
async function postToHass(url, body) {
    // @ts-ignore
    return await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env["HASSTOKEN"]}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
}

/**
 * @param {Response} response
 * @returns {Promise<Buffer>}
 */
async function getBufferFromResponse(response) {
    return Buffer.from(await response.arrayBuffer());
}

module.exports = { fetchWithTimeout, getFromHass, postToHass, getBufferFromResponse };
