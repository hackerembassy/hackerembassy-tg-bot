import config from "config";

import { EmbassyApiConfig } from "../config/schema";
import { getFromHass, postToHass } from "../utils/network";

const embassyApiConfig = config.get("embassy-api") as EmbassyApiConfig;
const climateConfig = embassyApiConfig.climate;

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

export type ConditionerMode = "off" | "auto" | "cool" | "dry" | "fan_only" | "heat_cool" | "heat";

class Conditioner {
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
