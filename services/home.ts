import config from "config";
import { getFromHass } from "../utils/network";
const embassyApiConfig = config.get("embassy-api") as any;
const climateConfig = embassyApiConfig.climate;

interface FloorClimate {
    temperature: number | "?";
    humidity: number | "?";
}

interface SpaceClimate {
    firstFloor: FloorClimate;
    secondFloor: FloorClimate;
    bedroom: FloorClimate;
}

export async function getClimate(): Promise<SpaceClimate> {
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

function getValueOrDefault(climateValue: PromiseSettledResult<any>, defaultValue = "?") {
    return climateValue.status === "fulfilled" && climateValue.value.state ? climateValue.value.state : defaultValue;
}
