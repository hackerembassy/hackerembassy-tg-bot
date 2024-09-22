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
    Prometheus = "prometheus",
}

export type PrometheusResponse = {
    status: "success" | "error";
    data: {
        resultType: string;
        result: Array<{
            metric: {
                __name__: string;
                bssid: string;
                channel: string;
                encryption: string;
                frequency: string;
                instance: string;
                job: string;
                ssid: string;
                mac?: string; // Only for dawn_station_signal_dbm
                station?: string; // Only for hostapd_station_flag_assoc
                vif: string;
            };
            value: [number, string];
        }>;
    };
};

async function getDevicesFromPrometheus() {
    const response = await fetchWithTimeout(
        `${embassyApiConfig.spacenetwork.prometheusorigin}/api/v1/query?query=dawn_station_signal_dbm%20or%20hostapd_station_flag_assoc`
    );

    if (!response.ok) throw new Error(`Prometheus query failed with status ${response.status}`);

    const json = (await response.json()) as PrometheusResponse;

    if (json.status !== "success") throw new Error(`Prometheus query failed`);

    return json.data.result.map(result => result.metric.mac ?? result.metric.station).filter(Boolean);
}

async function deviceRequest(method: DeviceCheckingMethod) {
    if (method === DeviceCheckingMethod.Prometheus) {
        return getDevicesFromPrometheus();
    }

    const embassyRequest = await requestToEmbassy(`/devices/inside?method=${method}`, "GET", undefined, 50000);

    if (!embassyRequest.ok) throw new Error(`Embassy request failed with status ${embassyRequest.status}`);

    return embassyRequest.json();
}

export async function fetchDevicesInside() {
    const primaryMethod = embassyApiConfig.spacenetwork.deviceCheckingMethod.primary as DeviceCheckingMethod;
    const secondaryMethod = embassyApiConfig.spacenetwork.deviceCheckingMethod.secondary as DeviceCheckingMethod | undefined;

    const [primaryResponse, secondaryResponse] = await Promise.allSettled([
        deviceRequest(primaryMethod),
        secondaryMethod ? deviceRequest(secondaryMethod) : Promise.resolve(undefined),
    ]);

    const devicesList = [
        ...(primaryResponse.status === "fulfilled" && primaryResponse.value ? await primaryResponse.value : []),
        ...(secondaryResponse.status === "fulfilled" && secondaryResponse.value ? await secondaryResponse.value : []),
    ];

    return devicesList.map((device: string) => device.toLowerCase());
}
