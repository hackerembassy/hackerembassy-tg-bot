import https from "https";

import find from "local-devices";
// @ts-ignore
import { LUCI } from "luci-rpc";
import { connect } from "mqtt";
import { default as fetch, RequestInit, Response } from "node-fetch";
import { NodeSSH } from "node-ssh";
import { promise } from "ping";
import wol from "wol";

const DEFAULT_NETWORK_TIMEOUT = 8000;
const DEFAULT_CANCELLATION_TIMEOUT = 15000;

type LuciWlanAdapters = {
    result: {
        results?: {
            mac?: string;
        }[];
    }[];
};

const tlsIgnoreAgent = new https.Agent({
    rejectUnauthorized: false,
});

class Cancellation {
    controller: AbortController;
    timeoutId: NodeJS.Timeout;

    constructor(timeout = DEFAULT_CANCELLATION_TIMEOUT) {
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

export function fetchWithTimeout(uri: string, options?: RequestInit & { timeout?: number }): Promise<Response> {
    const timeout = options?.timeout ?? DEFAULT_NETWORK_TIMEOUT;
    const cancellation = new Cancellation(timeout);

    // @ts-ignore
    return fetch(uri, { signal: cancellation.signal, ...options }).finally(() => cancellation.reset());
}

export async function getBufferFromResponse(response: Response): Promise<Buffer> {
    if (response.status !== 200) {
        throw new Error(`HTTP error ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
}

export async function wakeOnLan(mac: string) {
    return await wol.wake(mac);
}

export function ping(host: string) {
    return promise.probe(host, {
        timeout: 5,
        min_reply: 4,
    });
}

export function mqttSendOnce(mqtthost: string, topic: string, message: string, username?: string, password?: string) {
    return new Promise((resolve, reject) => {
        const client = connect(`mqtt://${mqtthost}`, {
            username,
            password,
        });
        client.on("connect", function () {
            client.subscribe(topic, function (err?: Error) {
                if (err) reject(err);

                client.publish(topic, message);
                client.end();

                resolve(true);
            });
        });
    });
}

export async function arp(ip: string): Promise<string> {
    const device = (await find({ address: ip })) as unknown as { mac: string } | undefined;

    if (!device) throw new Error(`Device not found for IP ${ip}`);

    return device.mac;
}

export class NeworkDevicesLocator {
    static async getDevicesFromKeenetic(routerip: string, username: string, password: string) {
        const ssh = new NodeSSH();

        await ssh.connect({
            host: routerip,
            username,
            password,
        });

        const sshdata = await ssh.exec("show associations", [""]);
        const macs = [...sshdata.matchAll(/mac: ((?:[0-9A-Fa-f]{2}[:-]){5}(?:[0-9A-Fa-f]{2}))/gm)].map(item => item[1]);

        ssh.dispose();

        return macs;
    }

    static async getDevicesFromOpenWrt(routerip: string, token?: string) {
        if (!token) throw Error("Token is required");

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const luci = new LUCI(`https://${routerip}`, "bot", token) as {
            init: () => Promise<void>;
            autoUpdateToken: (arg: number) => void;
            token?: string;
        };
        await luci.init();
        luci.autoUpdateToken(1000 * 60 * 30);

        const rpc = [
            {
                jsonrpc: "2.0",
                id: 93,
                method: "call",
                params: [luci.token, "iwinfo", "assoclist", { device: "phy0-ap0" }],
            },
            {
                jsonrpc: "2.0",
                id: 94,
                method: "call",
                params: [luci.token, "iwinfo", "assoclist", { device: "phy1-ap0" }],
            },
        ];

        const response = await fetch(`http://${routerip}/ubus/`, {
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(rpc),
            method: "POST",
        });

        const adapters = (await response.json()) as LuciWlanAdapters[];
        let macs: string[] = [];

        for (const wlanAdapter of adapters) {
            const devices = wlanAdapter.result[1]?.results;
            if (devices) macs = macs.concat(devices.map(dev => dev.mac?.toLowerCase() ?? ""));
        }

        return macs;
    }

    static async getDevicesFromUnifiController(host: string, username: string, password: string) {
        const loginResponse = await fetch(`${host}/api/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            agent: tlsIgnoreAgent,
            body: JSON.stringify({
                username,
                password,
            }),
        });

        if (loginResponse.status !== 200) throw new Error("Login failed");

        const cookiesHeader = loginResponse.headers
            .raw()
            ["set-cookie"].map((cookie: string) => cookie.split(";")[0])
            .join("; ");

        const devicesResponse = await fetch(`${host}/api/s/default/stat/sta`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Cookie: cookiesHeader,
            },
            agent: tlsIgnoreAgent,

            body: JSON.stringify({
                username,
                password,
            }),
        });

        if (devicesResponse.status !== 200) throw new Error("Failed to get devices");

        const devices = (await devicesResponse.json()) as { data: { mac: string }[] };

        return devices.data.map((device: { mac: string }) => device.mac);
    }

    static async findDevicesUsingNmap(networkRange: string) {
        const devices = await find({ address: networkRange });
        return devices.map(d => d.mac);
    }
}
