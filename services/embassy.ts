import config from "config";

import { EmbassyApiConfig } from "@config";
import { fetchWithTimeout } from "@utils/network";
import { encrypt } from "@utils/security";

const embassyApiConfig = config.get<EmbassyApiConfig>("embassy-api");

export const EmbassyBase = `${embassyApiConfig.service.host}:${embassyApiConfig.service.port}`;
export const EmbassyBaseIP = `http://${embassyApiConfig.service.ip}:${embassyApiConfig.service.port}`;

export async function requestToEmbassy(
    endpoint: string,
    method: "GET" | "POST" = "GET",
    body: any = undefined,
    timeout: number = 15000,
    secure = true
) {
    const authorization = secure && process.env["UNLOCKKEY"] ? await encrypt(process.env["UNLOCKKEY"]) : undefined;

    const options = {
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            authorization,
        },
        method,
        timeout,
    } as RequestInit;

    if (method === "POST") options.body = body ? JSON.stringify(body) : "{}";

    return await fetchWithTimeout(`${EmbassyBase}${endpoint}`, options);
}

export async function fetchDevicesInside() {
    const response = await requestToEmbassy(
        `/devices/inside?method=${embassyApiConfig.spacenetwork.devicesCheckingMethod}`,
        "GET",
        undefined,
        50000
    );

    if (!response.ok) throw new Error("Failed to fetch devices inside");

    return (await response.json()) as string[];
}
