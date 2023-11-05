import config from "config";
import { default as fetch } from "node-fetch";
import wol from "wol";

import { EmbassyApiConfig } from "../config/schema";

const embassyApiConfig = config.get<EmbassyApiConfig>("embassy-api");

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

export function fetchWithTimeout(uri: string, options: any = undefined, ...rest: any[]): Promise<Response> {
    const cancellation = new Cancellation(options?.timeout ?? embassyApiConfig.timeout);

    // @ts-ignore
    return fetch(uri, { signal: cancellation.signal, ...options }, ...rest);
}

export async function getFromHass(url: string): Promise<Response> {
    // @ts-ignore
    return await fetch(`${url}`, {
        headers: {
            Authorization: `Bearer ${process.env["HASSTOKEN"]}`,
            "Content-Type": "application/json",
        },
    });
}

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

export async function getBufferFromResponse(response: Response): Promise<Buffer> {
    if (response.status !== 200) {
        throw new Error(`HTTP error ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
}

export function filterFulfilled<T>(results: PromiseSettledResult<T>[]): PromiseFulfilledResult<T>[] {
    return results.filter(result => result.status === "fulfilled") as PromiseFulfilledResult<T>[];
}

export async function wakeOnLan(mac: string) {
    return await wol.wake(mac);
}
