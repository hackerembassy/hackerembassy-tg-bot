import config from "config";
import { RequestInit } from "node-fetch";

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

export enum DeviceCheckingMethod {
    OpenWRT = "openwrt",
    Scan = "scan",
    Unifi = "unifi",
    Keenetic = "keenetic",
}

export async function fetchDevicesInside() {
    const primaryMethod = embassyApiConfig.spacenetwork.deviceCheckingMethod.primary as DeviceCheckingMethod;
    const secondaryMethod = embassyApiConfig.spacenetwork.deviceCheckingMethod.secondary as DeviceCheckingMethod | undefined;

    const primaryRequest = requestToEmbassy(`/devices/inside?method=${primaryMethod}`, "GET", undefined, 50000);
    const secondaryRequest = secondaryMethod
        ? requestToEmbassy(`/devices/inside?method=${secondaryMethod}`, "GET", undefined, 50000)
        : Promise.resolve(undefined);

    const [primaryResponse, secondaryResponse] = await Promise.allSettled([primaryRequest, secondaryRequest]);

    const devicesList = [
        ...(primaryResponse.status === "fulfilled" && primaryResponse.value.ok ? await primaryResponse.value.json() : []),
        ...(secondaryResponse.status === "fulfilled" && secondaryResponse.value?.ok ? await secondaryResponse.value.json() : []),
    ];

    return devicesList as string[];
}
