import logger from "@services/common/logger";

import HackerEmbassyBot from "./core/HackerEmbassyBot";
import { setMenu } from "./menu";
import { setAutomaticFeatures } from "./recurring-actions";
import { addEventHandlers, addRoutes, addSpecialRoutes } from "./router";

// Configure the bot singleton instance
if (!process.env["HACKERBOTTOKEN"]) {
    logger.error("HACKERBOTTOKEN is not defined");
    logger.error("Please set HACKERBOTTOKEN in the .env file or evironment variables");
    logger.error("Exiting...");
    process.exit(1);
}

const bot = new HackerEmbassyBot(process.env["HACKERBOTTOKEN"]);

export function StartTelegramBot() {
    addRoutes(bot);
    addSpecialRoutes(bot);
    addEventHandlers(bot);
    setAutomaticFeatures(bot);
    setMenu(bot);

    bot.start();
}

export default bot;
