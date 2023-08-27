import logger from "../services/logger";
import HackerEmbassyBot from "./HackerEmbassyBot";
import { setRoutes } from "./bot-routes";
import { setAutomaticFeatures } from "./bot-automatic";
import { setMenu } from "./bot-menu";

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
