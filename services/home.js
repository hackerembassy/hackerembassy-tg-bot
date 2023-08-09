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
 */

/**
 * @returns {Promise<SpaceClimate>}
 */
async function getClimate() {
    try {
        const climateValues = await Promise.allSettled([
            (await getFromHass(climateConfig.first_floor.temperature)).json(),
            (await getFromHass(climateConfig.first_floor.humidity)).json(),
            (await getFromHass(climateConfig.second_floor.temperature)).json(),
            (await getFromHass(climateConfig.second_floor.humidity)).json(),
        ]);

        return {
            firstFloor: {
                temperature:
                    climateValues[0].status === "fulfilled" && climateValues[0].value.state ? climateValues[0].value.state : "?",
                humidity:
                    climateValues[1].status === "fulfilled" && climateValues[1].value.state ? climateValues[1].value.state : "?",
            },
            secondFloor: {
                temperature:
                    climateValues[2].status === "fulfilled" && climateValues[2].value.state ? climateValues[2].value.state : "?",
                humidity:
                    climateValues[3].status === "fulfilled" && climateValues[3].value.state ? climateValues[3].value.state : "?",
            },
        };
    } catch {
        return null;
    }
}

module.exports = { getClimate };
