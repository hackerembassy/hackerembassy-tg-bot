import { exec } from "child_process";
import config from "config";
import { promises as fs } from "fs";
import { connect } from "mqtt";
import { default as fetch } from "node-fetch";
import { promise } from "ping";
import wol from "wol";

import { NetworkConfig } from "../config/schema";

const networkConfig = config.get<NetworkConfig>("network");

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
    const cancellation = new Cancellation(options?.timeout ?? networkConfig.timeout);

    // @ts-ignore
    return fetch(uri, { signal: cancellation.signal, ...options }, ...rest).finally(() => cancellation.reset());
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

export async function ping(host: string) {
    const probingResult = await promise.probe(host, {
        timeout: 5,
        min_reply: 4,
    });

    return probingResult;
}

export function mqttSendOnce(mqtthost: string, topic: string, message: string, username?: string, password?: string): void {
    const client = connect(`mqtt://${mqtthost}`, {
        username,
        password,
    });
    client.on("connect", function () {
        client.subscribe(topic, function (err?: Error) {
            if (!err) {
                client.publish(topic, message);
                client.end();
            } else {
                throw err;
            }
        });
    });
}

/** @deprecated Use HASS */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getImageFromRTSP(url: string, filename: string): Promise<Buffer> {
    const child = exec(`ffmpeg -i rtsp://${url} -frames:v 1 -f image2 ${filename}.jpg -y`, (error, stdout, stderr) => {
        if (error) throw Error;
        if (stderr) throw Error(stderr);
    });

    await new Promise(resolve => {
        child.on("close", resolve);
    });

    return await fs.readFile("./tmp.jpg");
}
