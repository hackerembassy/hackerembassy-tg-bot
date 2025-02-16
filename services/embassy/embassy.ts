import config from "config";
import { RequestInit } from "node-fetch";
import { PingResponse } from "ping";

import { EmbassyApiConfig } from "@config";
import { User } from "@data/models";
import { fetchWithTimeout, successOrThrow } from "@utils/network";
import { encrypt } from "@utils/security";
import { anyItemIsInList, filterFulfilled } from "@utils/filters";

import { AvailableConditioner, ConditionerActions, ConditionerStatus, SpaceClimate } from "./hass";
import { PrinterStatusResult } from "./printer3d";
import { UnlockMethod } from "./door";
import logger from "../common/logger";

const embassyApiConfig = config.get<EmbassyApiConfig>("embassy-api");

export const EmbassyBase = `${embassyApiConfig.service.host}:${embassyApiConfig.service.port}`;
export const EmbassyBaseIP = `http://${embassyApiConfig.service.ip}:${embassyApiConfig.service.port}`;
export const EmbassyBaseLocalDns = `http://${embassyApiConfig.service.localdns}:${embassyApiConfig.service.port}`;
export const EmbassyLinkMacUrl = `${EmbassyBaseLocalDns}/devices/linkmac`;

export enum DeviceCheckingMethod {
    OpenWRT = "openwrt",
    Scan = "scan",
    Unifi = "unifi",
    Keenetic = "keenetic",
    Prometheus = "prometheus",
}

type PrometheusResponse = {
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

class EmbassyService {
    // Public

    async unlockDoor(user: User) {
        const hasMacInside = await this.hasDeviceInside(user);

        if (!hasMacInside)
            throw Error(`User ${user.username} is not inside, but he/she tried to unlock the door`, {
                cause: "mac",
            });

        const response = await this.requestToEmbassy(
            `/space/unlock`,
            "POST",
            { from: user.username ?? user.userid, method: UnlockMethod.HTTP },
            20000,
            true
        );

        if (!response.ok)
            throw Error("Unlock request to space failed", {
                cause: response.statusText,
            });

        logger.info(`${user.username}[${user.userid}] opened the door`);
    }

    async getAllCameras() {
        const camNames = Object.keys(embassyApiConfig.cams);
        const camResponses = await Promise.allSettled(camNames.map(name => this.requestToEmbassy(`/cameras/${name}`)));

        const images: ArrayBuffer[] = await Promise.all(
            filterFulfilled(camResponses)
                .filter(result => result.value.ok)
                .map(result => result.value.arrayBuffer())
        );

        return images;
    }
    async getPrinterStatus(printername: string) {
        const response = await this.requestToEmbassy(`/printers/${printername}`);

        return response.json() as Promise<PrinterStatusResult>;
    }
    async getSounds() {
        const response = await this.requestToEmbassy(`/speaker/sounds`);
        const { sounds } = (await response.json()) as { sounds: string[] };

        return sounds;
    }

    playSound(linkOrName: string) {
        // TODO move to hass
        const defaultMediaBase = "http://le-fail.lan:8001";
        const link = linkOrName.startsWith("http") ? linkOrName : `${defaultMediaBase}/${linkOrName}.mp3`;

        return this.requestToEmbassy(`/speaker/play`, "POST", { link }).then(successOrThrow);
    }

    async getSpaceClimate() {
        const response = await this.requestToEmbassy(`/climate`, "GET", null, 4000);

        return response.json() as Promise<SpaceClimate>;
    }

    async getConditionerStatus(name: string) {
        const response = await this.requestToEmbassy(`/climate/conditioners/${name}/${ConditionerActions.STATE}`);

        return response.json() as Promise<ConditionerStatus>;
    }

    async pingDevice(deviceName: string) {
        const response = await this.requestToEmbassy(`/devices/${deviceName}/ping`, "POST");

        if (!response.ok) throw Error();

        return response.json() as Promise<PingResponse>;
    }

    shutdownDevice(deviceName: string) {
        return this.requestToEmbassy(`/devices/${deviceName}/shutdown`, "POST").then(successOrThrow);
    }

    ledMatrix(message: string) {
        return this.requestToEmbassy(`/space/led-matrix`, "POST", { message }, 30000).then(successOrThrow);
    }

    clearScreen() {
        return this.requestToEmbassy(`/screen/close_popup`, "POST").then(successOrThrow);
    }

    showScreen(html: string) {
        return this.requestToEmbassy(`/screen/popup`, "POST", { html }, 30000).then(successOrThrow);
    }

    doorbell() {
        return this.requestToEmbassy("/space/doorbell").then(successOrThrow);
    }

    wakeDevice(deviceName: string) {
        return this.requestToEmbassy(`/devices/${deviceName}/wake`, "POST").then(successOrThrow);
    }

    controlConditioner(name: AvailableConditioner, action: ConditionerActions, body: any) {
        return this.requestToEmbassy(`/climate/conditioners/${name}/${action}`, "POST", body).then(successOrThrow);
    }

    tts(text: string) {
        return this.requestToEmbassy(`/speaker/tts`, "POST", { text }, 30000).then(successOrThrow);
    }

    stopMedia() {
        return this.requestToEmbassy(`/speaker/stop`, "POST").then(successOrThrow);
    }

    async getWebcamImage(camName: string) {
        const response = await (await this.requestToEmbassy(`/cameras/${camName}`)).arrayBuffer();

        return Buffer.from(response);
    }

    async img2img(positive_prompt: string, negative_prompt: string, imageBase64: string) {
        const response = await this.requestToEmbassy("/neural/sd/img2img", "POST", {
            prompt: positive_prompt,
            negative_prompt,
            image: imageBase64,
        });
        const body = (await response.json()) as { image: string };

        return Buffer.from(body.image, "base64");
    }

    async txt2img(positive_prompt: string, negative_prompt: string) {
        const response = await this.requestToEmbassy("/neural/sd/txt2img", "POST", { prompt: positive_prompt, negative_prompt });
        const body = (await response.json()) as { image: string };

        return Buffer.from(body.image, "base64");
    }

    async ollama(prompt: string) {
        const response = await this.requestToEmbassy("/neural/ollama/generate", "POST", { prompt }, 90000);
        const data = (await response.json()) as { response: string };

        return data.response;
    }

    async hasDeviceInside(user: User) {
        const devices = await this.fetchDevicesInside();
        return user.mac ? this.isMacInside(user.mac, devices) : false;
    }

    async usersWithDevices(users: User[]) {
        const devices = await this.fetchDevicesInside();
        return users.map(user => ({ ...user, hasDeviceInside: !!user.mac && this.isMacInside(user.mac, devices) }));
    }

    public async fetchDevicesInside() {
        const primaryMethod = embassyApiConfig.spacenetwork.deviceCheckingMethod.primary as DeviceCheckingMethod;
        const secondaryMethod = embassyApiConfig.spacenetwork.deviceCheckingMethod.secondary as DeviceCheckingMethod | undefined;

        const [primaryResponse, secondaryResponse] = await Promise.allSettled([
            this.deviceRequest(primaryMethod),
            secondaryMethod ? this.deviceRequest(secondaryMethod) : Promise.resolve(undefined),
        ]);

        const devicesList = [
            ...(primaryResponse.status === "fulfilled" && primaryResponse.value ? await primaryResponse.value : []),
            ...(secondaryResponse.status === "fulfilled" && secondaryResponse.value ? await secondaryResponse.value : []),
        ];

        return devicesList.map((device: string) => device.toLowerCase());
    }

    // Private

    private isMacInside(mac: string, devices: string[]): boolean {
        return anyItemIsInList(mac.split(","), devices);
    }

    private async getDevicesFromPrometheus() {
        const response = await fetchWithTimeout(
            `${embassyApiConfig.spacenetwork.prometheusorigin}/api/v1/query?query=dawn_station_signal_dbm%20or%20hostapd_station_flag_assoc`
        );

        if (!response.ok) throw new Error(`Prometheus query failed with status ${response.status}`);

        const json = (await response.json()) as PrometheusResponse;

        if (json.status !== "success") throw new Error(`Prometheus query failed`);

        return json.data.result.map(result => result.metric.mac ?? result.metric.station).filter(Boolean);
    }

    private async deviceRequest(method: DeviceCheckingMethod) {
        if (method === DeviceCheckingMethod.Prometheus) {
            return this.getDevicesFromPrometheus();
        }

        const embassyRequest = await this.requestToEmbassy(`/devices/inside?method=${method}`, "GET", undefined, 50000);

        if (!embassyRequest.ok) throw new Error(`Embassy request failed with status ${embassyRequest.status}`);

        return embassyRequest.json();
    }

    private async requestToEmbassy(
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
}

export default new EmbassyService();
