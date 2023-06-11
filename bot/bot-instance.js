const logger = require("../services/logger");
const { HackerEmbassyBot } = require("./HackerEmbassyBot");
const { setRoutes } = require("./bot-routes");
const { setAutomaticFeatures } = require("./bot-automatic");

// Configure the bot singleton instance
const bot = new HackerEmbassyBot(process.env["HACKERBOTTOKEN"], { polling: true });
setRoutes(bot);
setAutomaticFeatures(bot);

logger.info(`Bot is ready to accept commands`);

module.exports = bot;
