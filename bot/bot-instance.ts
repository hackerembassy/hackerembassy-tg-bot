import logger from "../services/logger";
import { setAutomaticFeatures } from "./bot-automatic";
import { setMenu } from "./bot-menu";
import { setRoutes } from "./bot-routes";
import HackerEmbassyBot from "./HackerEmbassyBot";

async function init(bot: HackerEmbassyBot) {
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

export default bot;