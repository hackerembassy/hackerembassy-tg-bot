import config from "config";

import { CamConfig, EmbassyApiConfig } from "../config/schema";
import { getBufferFromResponse } from "../utils/network";

const embassyApiConfig = config.get<EmbassyApiConfig>("embassy-api");
const climateConfig = embassyApiConfig.climate;

import path from "node:path";

import { promises as fs } from "fs";

import { downloadTmpFile } from "../utils/filesystem";
import { convertMedia } from "../utils/media";
import { EmbassyBaseIP } from "./embassy";

// Types
export type ConditionerMode = "off" | "auto" | "cool" | "dry" | "fan_only" | "heat_cool" | "heat";

export type ConditionerStatus = {
    entity_id: string;
    state: string;
    attributes: Attributes;
    last_changed: Date;
    last_updated: Date;
    context: Context;
    error: string;
};

export type Attributes = {
    hvac_modes: string[];
    min_temp: number;
    max_temp: number;
    target_temp_step: number;
    fan_modes: string[];
    preset_modes: string[];
    swing_modes: string[];
    current_temperature: number;
    temperature: number;
    fan_mode: string;
    preset_mode: string;
    swing_mode: string;
    friendly_name: string;
    supported_features: number;
};

export type Context = {
    id: string;
    parent_id: null;
    user_id: null;
};

interface FloorClimate {
    temperature: number | "?";
    humidity: number | "?";
    co2?: number | "?";
}

export interface SpaceClimate {
    firstFloor: FloorClimate;
    secondFloor: FloorClimate;
    bedroom: FloorClimate;
}

// Media
export async function getWebcamImage(camName: keyof CamConfig): Promise<Buffer> {
    if (!embassyApiConfig.cams[camName]) throw ReferenceError("No cam with such name defined");

    return getBufferFromResponse(await getFromHass(embassyApiConfig.cams[camName]));
}

export async function sayInSpace(text: string): Promise<void> {
    const response = await postToHass(embassyApiConfig.speaker.ttspath, {
        message: text,
    });

    if (response.status !== 200) throw Error("Speaker request failed");
}

async function serveStaticFile(localPath: string, urlPath: string): Promise<string> {
    const staticRootPath = path.join(__dirname, "..", embassyApiConfig.service.static);
    const staticFilePath = path.join(staticRootPath, urlPath);

    await fs.mkdir(path.parse(staticFilePath).dir, { recursive: true });
    await fs.copyFile(localPath, staticFilePath);

    return `${EmbassyBaseIP}/${urlPath}`;
}

export async function playInSpace(link: string): Promise<void> {
    const requiresConversion = link.endsWith(".oga");

    let linkToPlay = link;

    if (requiresConversion) {
        const { tmpPath, cleanup } = await downloadTmpFile(link, ".oga");
        const convertedFilePath = await convertMedia(tmpPath, "mp3");

        linkToPlay = await serveStaticFile(convertedFilePath, `/tmp/${Date.now()}.mp3`);

        cleanup();
    }

    const response = await postToHass(embassyApiConfig.speaker.playpath, {
        entity_id: embassyApiConfig.speaker.entity,
        media_content_id: linkToPlay,
        media_content_type: "music",
    });

    if (response.status !== 200) throw Error("Speaker request failed");
}

export async function stopMediaInSpace(): Promise<void> {
    const response = await postToHass(embassyApiConfig.speaker.stoppath, {
        entity_id: embassyApiConfig.speaker.entity,
    });

    if (response.status !== 200) throw Error("Speaker request failed");
}

export async function ringDoorbell(): Promise<void> {
    const response = await postToHass(embassyApiConfig.doorbell.hasspath, {
        entity_id: "switch.doorbell",
    });

    if (response.status !== 200) throw Error("Ringing request failed");
}

// Climate
export async function getClimate(): Promise<Nullable<SpaceClimate>> {
    const queries = [
        (await getFromHass(climateConfig.first_floor.temperature)).json(),
        (await getFromHass(climateConfig.first_floor.humidity)).json(),
        (await getFromHass(climateConfig.first_floor.co2!)).json(),
        (await getFromHass(climateConfig.second_floor.temperature)).json(),
        (await getFromHass(climateConfig.second_floor.humidity)).json(),
        (await getFromHass(climateConfig.bedroom.temperature)).json(),
        (await getFromHass(climateConfig.bedroom.humidity)).json(),
    ];

    const climateValues = await Promise.allSettled(queries);

    return {
        firstFloor: {
            temperature: getValueOrDefault(climateValues[0]),
            humidity: getValueOrDefault(climateValues[1]),
            co2: getValueOrDefault(climateValues[2]),
        },
        secondFloor: {
            temperature: getValueOrDefault(climateValues[3]),
            humidity: getValueOrDefault(climateValues[4]),
        },
        bedroom: {
            temperature: getValueOrDefault(climateValues[5]),
            humidity: getValueOrDefault(climateValues[6]),
        },
    };
}

function getValueOrDefault(climateValue: PromiseSettledResult<any>, defaultValue = "?"): any {
    return climateValue.status === "fulfilled" && climateValue.value.state ? climateValue.value.state : defaultValue;
}

class Conditioner {
    async getState(): Promise<ConditionerStatus> {
        const response = await getFromHass(climateConfig.conditioner.statePath);
        return await response.json();
    }

    async turnOn() {
        await postToHass(climateConfig.conditioner.turnOnPath, {
            entity_id: climateConfig.conditioner.entityId,
        });
    }

    async turnOff() {
        await postToHass(climateConfig.conditioner.turnOffPath, {
            entity_id: climateConfig.conditioner.entityId,
        });
    }

    async setMode(mode: ConditionerMode) {
        await postToHass(climateConfig.conditioner.setModePath, {
            hvac_mode: mode,
            entity_id: climateConfig.conditioner.entityId,
        });
    }

    async preheat() {
        await postToHass(climateConfig.conditioner.preheatPath, {});
    }

    async setTemperature(temperature: number) {
        await postToHass(climateConfig.conditioner.setTemperaturePath, {
            temperature: temperature,
            entity_id: climateConfig.conditioner.entityId,
        });
    }
}

export const conditioner = new Conditioner();

// Hass requests
export async function getFromHass(path: string): Promise<Response> {
    // @ts-ignore
    return await fetch(embassyApiConfig.hassorigin + path, {
        headers: {
            Authorization: `Bearer ${process.env["HASSTOKEN"]}`,
            "Content-Type": "application/json",
        },
    });
}

export async function postToHass(path: string, body: any): Promise<Response> {
    // @ts-ignore
    return await fetch(embassyApiConfig.hassorigin + path, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env["HASSTOKEN"]}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
}
