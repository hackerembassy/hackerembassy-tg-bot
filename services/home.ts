import config from "config";

import { EmbassyApiConfig } from "../config/schema";
import { getFromHass, postToHass } from "../utils/network";

const embassyApiConfig = config.get<EmbassyApiConfig>("embassy-api");
const climateConfig = embassyApiConfig.climate;

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
}

export interface SpaceClimate {
    firstFloor: FloorClimate;
    secondFloor: FloorClimate;
    bedroom: FloorClimate;
}

export async function getClimate(): Promise<Nullable<SpaceClimate>> {
    try {
        const queries = [
            (await getFromHass(climateConfig.first_floor.temperature)).json(),
            (await getFromHass(climateConfig.first_floor.humidity)).json(),
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
            },
            secondFloor: {
                temperature: getValueOrDefault(climateValues[2]),
                humidity: getValueOrDefault(climateValues[3]),
            },
            bedroom: {
                temperature: getValueOrDefault(climateValues[4]),
                humidity: getValueOrDefault(climateValues[5]),
            },
        };
    } catch {
        return null;
    }
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

    async setTemperature(temperature: number) {
        await postToHass(climateConfig.conditioner.setTemperaturePath, {
            temperature: temperature,
            entity_id: climateConfig.conditioner.entityId,
        });
    }
}

export const conditioner = new Conditioner();
