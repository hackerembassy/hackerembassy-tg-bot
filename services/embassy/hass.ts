import os from "os";

import config from "config";
import fetch, { Response } from "node-fetch";

import { CamConfig, EmbassyApiConfig } from "@config";
import { getBufferFromResponse, runSSHCommand } from "@utils/network";

// Configs
const embassyApiConfig = config.get<EmbassyApiConfig>("embassy-api");
const climateConfig = embassyApiConfig.climate;
const alarmConfig = embassyApiConfig.alarm;

// Types
export type AvailableConditioner = "downstairs" | "upstairs";

export type ConditionerMode = "off" | "auto" | "cool" | "dry" | "fan_only" | "heat_cool" | "heat";

export enum ConditionerActions {
    POWER_ON = "power/on",
    POWER_OFF = "power/off",
    MODE = "mode",
    PREHEAT = "preheat",
    TEMPERATURE = "temperature",
    STATE = "state",
}

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
    temperature: string;
    humidity: string;
    co2?: string;
}

export interface SpaceClimate {
    firstFloor: FloorClimate;
    secondFloor: FloorClimate;
    bedroom: FloorClimate;
}

// Classes
class Cams {
    async getImage(camName: keyof CamConfig): Promise<Buffer> {
        if (!embassyApiConfig.cams[camName]) throw ReferenceError("No cam with such name defined");

        return getBufferFromResponse(await hass.get(embassyApiConfig.cams[camName]));
    }
}

class Speakers {
    async say(text: string): Promise<void> {
        const response = await hass.post(embassyApiConfig.speaker.ttspath, {
            message: text,
        });

        if (response.status !== 200) throw Error("Speaker request failed");
    }

    async play(link: string): Promise<void> {
        if (link.endsWith(".oga")) {
            // Prevent command injection
            if (link.match(/[^a-zA-Z0-9:/.\-_]/)) throw new Error("Invalid link");

            // ignore errors, ffmpeg writes to stderr
            await runSSHCommand(
                "hass.lan",
                22269,
                "hassio",
                os.homedir() + "/.ssh/hass",
                `wget --inet4-only -O /media/tmp/voice.oga ${link}`
            ).catch(() => null);
            await hass.post(embassyApiConfig.speaker.voicepath, {});
            return;
        }

        const response = await hass.post(embassyApiConfig.speaker.playpath, {
            entity_id: embassyApiConfig.speaker.entity,
            media_content_id: link,
            media_content_type: "music",
        });

        if (response.status !== 200) throw Error("Speaker request failed");
    }

    async stop(): Promise<void> {
        const response = await hass.post(embassyApiConfig.speaker.stoppath, {
            entity_id: embassyApiConfig.speaker.entity,
        });

        if (response.status !== 200) throw Error("Speaker request failed");
    }
}

class Displays {
    async showPopup(html: string): Promise<void> {
        const response = await hass.post(embassyApiConfig.browser.popuppath, {
            browser_id: embassyApiConfig.browser.target,
            content: html,
            size: "fullscreen",
        });

        if (response.status !== 200) throw Error("Browser request failed");
    }

    async closePopup(): Promise<void> {
        const response = await hass.post(embassyApiConfig.browser.closepath, {
            browser_id: embassyApiConfig.browser.target,
        });

        if (response.status !== 200) throw Error("Browser request failed");
    }

    async showOnMatrix(text: string): Promise<void> {
        const response = await hass.post(embassyApiConfig.ledmatrix.textpath, {
            message: text,
        });

        if (response.status !== 200) throw Error("Matrix request failed");
    }
}

class Sensors {
    public async getClimate(): Promise<Nullable<SpaceClimate>> {
        const queries = [
            hass.get(climateConfig.first_floor.temperature).then(response => response.json()),
            hass.get(climateConfig.first_floor.humidity).then(response => response.json()),
            hass.get(climateConfig.first_floor.co2!).then(response => response.json()),
            hass.get(climateConfig.second_floor.temperature).then(response => response.json()),
            hass.get(climateConfig.second_floor.humidity).then(response => response.json()),
            hass.get(climateConfig.bedroom.temperature).then(response => response.json()),
            hass.get(climateConfig.bedroom.humidity).then(response => response.json()),
        ];

        const climateValues = (await Promise.allSettled(queries)) as PromiseSettledResult<{ state?: string }>[];

        return {
            firstFloor: {
                temperature: this.getValueOrDefault(climateValues[0]),
                humidity: this.getValueOrDefault(climateValues[1]),
                co2: this.getValueOrDefault(climateValues[2]),
            },
            secondFloor: {
                temperature: this.getValueOrDefault(climateValues[3]),
                humidity: this.getValueOrDefault(climateValues[4]),
            },
            bedroom: {
                temperature: this.getValueOrDefault(climateValues[5]),
                humidity: this.getValueOrDefault(climateValues[6]),
            },
        };
    }

    private getValueOrDefault(climateValue?: PromiseSettledResult<{ state?: string }>, defaultValue = "?"): string {
        return climateValue?.status === "fulfilled" && climateValue.value.state ? climateValue.value.state : defaultValue;
    }
}

class Alarm {
    async disarm() {
        await hass.post(alarmConfig.disarmpath, {});
    }
}

class Conditioner {
    constructor(private entityId: string) {}

    async getState() {
        const response = await hass.get(`${climateConfig.conditioner.statePath}/${this.entityId}`);
        return response.json() as Promise<ConditionerStatus>;
    }

    turnOn() {
        return hass.post(climateConfig.conditioner.turnOnPath, {
            entity_id: this.entityId,
        });
    }

    turnOff() {
        return hass.post(climateConfig.conditioner.turnOffPath, {
            entity_id: this.entityId,
        });
    }

    setMode(mode: ConditionerMode) {
        return hass.post(climateConfig.conditioner.setModePath, {
            hvac_mode: mode,
            entity_id: this.entityId,
        });
    }

    preheat() {
        return hass.post(climateConfig.conditioner.preheatPath, {});
    }

    setTemperature(temperature: number) {
        return hass.post(climateConfig.conditioner.setTemperaturePath, {
            temperature: temperature,
            entity_id: this.entityId,
        });
    }
}

export const AvailableConditioners = new Map<string, Conditioner>([
    ["downstairs", new Conditioner(climateConfig.conditioner.downstairsId)],
    ["upstairs", new Conditioner(climateConfig.conditioner.upstairsId)],
]);

class Hass {
    get(path: string): Promise<Response> {
        return fetch(embassyApiConfig.hassorigin + path, {
            headers: {
                Authorization: `Bearer ${process.env["HASSTOKEN"]}`,
                "Content-Type": "application/json",
            },
        });
    }

    post(path: string, body: any): Promise<Response> {
        return fetch(embassyApiConfig.hassorigin + path, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env["HASSTOKEN"]}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });
    }
}

// Instances
const hass = new Hass();

export const alarm = new Alarm();
export const sensors = new Sensors();
export const speakers = new Speakers();
export const displays = new Displays();
export const cams = new Cams();
