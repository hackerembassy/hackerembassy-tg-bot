import config from "config";

import { EmbassyApiConfig } from "@config";
import { fetchWithTimeout } from "@utils/network";

const embassyApiConfig = config.get<EmbassyApiConfig>("embassy-api");

export const EmbassyBase = `${embassyApiConfig.service.host}:${embassyApiConfig.service.port}`;
export const EmbassyBaseIP = `http://${embassyApiConfig.service.ip}:${embassyApiConfig.service.port}`;

export async function requestToEmbassy(
    endpoint: string,
    method: "GET" | "POST" = "GET",
    body: any = undefined,
    timeout: number = 15000
) {
    const options = {
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        method,
        timeout,
    } as RequestInit;

    if (method === "POST") {
        options.body = body ? JSON.stringify(body) : "{}";
    }

    return await fetchWithTimeout(`${EmbassyBase}${endpoint}`, options);
}

export async function fetchDevicesInside() {
    const response = await requestToEmbassy(`/devices/inside?method=${embassyApiConfig.spacenetwork.devicesCheckingMethod}`);

    if (!response.ok) throw new Error("Failed to fetch devices inside");

    return (await response.json()) as string[];
}
