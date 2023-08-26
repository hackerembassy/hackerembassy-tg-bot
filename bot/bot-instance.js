const logger = require("../services/logger");
const { HackerEmbassyBot } = require("./HackerEmbassyBot");
const { setRoutes } = require("./bot-routes");
const { setAutomaticFeatures } = require("./bot-automatic");
const { setMenu } = require("./bot-menu");

/** @param {HackerEmbassyBot} bot */
async function init(bot) {
    const botInstanceInfo = await bot.getMe();
    bot.Name = botInstanceInfo.username;
    setRoutes(bot);
    setAutomaticFeatures(bot);
    setMenu(bot);

    logger.info(`Bot is ready to accept commands`);
}

// Configure the bot singleton instance
const bot = new HackerEmbassyBot(process.env["HACKERBOTTOKEN"], { polling: true });

init(bot);

module.exports = bot;
