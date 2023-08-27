import config from "config";
const embassyApiConfig = config.get("embassy-api") as any;
import { default as fetch } from "node-fetch";

class Cancellation {
    controller: AbortController;
    timeoutId: NodeJS.Timeout;

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
export function fetchWithTimeout(uri: string, options: any = undefined, ...rest: any[]) {
    const cancellation = new Cancellation(options?.timeout ?? embassyApiConfig.timeout);

    // @ts-ignore
    return fetch(uri, { signal: cancellation.signal, ...options }, ...rest);
}

/**
 * @param {string} url
 * @returns {Promise<Response>}
 */
export async function getFromHass(url: string): Promise<Response> {
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
export async function postToHass(url: string, body: any): Promise<Response> {
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
export async function getBufferFromResponse(response: Response): Promise<Buffer> {
    return Buffer.from(await response.arrayBuffer());
}
