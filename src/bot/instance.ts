import logger from "@services/common/logger";

import HackerEmbassyBot from "./core/classes/HackerEmbassyBot";
import { setAutomaticFeatures } from "./cron";
import { addControllers, addSpecialRoutes, setMenu } from "./setup";
import { addBotListeners } from "./listeners";

// Configure the bot singleton instance
if (!process.env["HACKERBOTTOKEN"]) {
    logger.error("HACKERBOTTOKEN is not defined");
    logger.error("Please set HACKERBOTTOKEN in the .env file or evironment variables");
    logger.error("Exiting...");
    process.exit(1);
}

const bot = new HackerEmbassyBot(process.env["HACKERBOTTOKEN"]);

export function StartTelegramBot() {
    addControllers(bot);
    addSpecialRoutes(bot);
    addBotListeners(bot);
    setAutomaticFeatures(bot);
    void setMenu(bot);

    bot.start();
}

export default bot;
