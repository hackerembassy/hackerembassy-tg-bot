const config = require("config");
const { getFromHass } = require("../utils/network");
const embassyApiConfig = config.get("embassy-api");
const climateConfig = embassyApiConfig.climate;

/**
 * @typedef {Object} FloorClimate
 * @property {number | "?"} temperature
 * @property {number | "?"} humidity
 */

/**
 * @typedef {Object} SpaceClimate
 * @property {FloorClimate} firstFloor
 * @property {FloorClimate} secondFloor
 * @property {FloorClimate} bedroom
 */

/**
 * @returns {Promise<SpaceClimate>}
 */
async function getClimate() {
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

/**
 * @param {PromiseSettledResult<any>} climateValue
 */
function getValueOrDefault(climateValue, defaultValue = "?") {
    return climateValue.status === "fulfilled" && climateValue.value.state ? climateValue.value.state : defaultValue;
}

module.exports = { getClimate };
