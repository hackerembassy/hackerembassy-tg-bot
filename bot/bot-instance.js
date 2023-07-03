const logger = require("../services/logger");
const { HackerEmbassyBot } = require("./HackerEmbassyBot");
const { setRoutes } = require("./bot-routes");
const { setAutomaticFeatures } = require("./bot-automatic");
const { setMenu } = require("./bot-menu");

// Configure the bot singleton instance
const bot = new HackerEmbassyBot(process.env["HACKERBOTTOKEN"], { polling: true });
setRoutes(bot);
setAutomaticFeatures(bot);
setMenu(bot);

logger.info(`Bot is ready to accept commands`);

module.exports = bot;
