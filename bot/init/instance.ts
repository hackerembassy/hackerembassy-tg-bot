import config from "config";
import { promises as fs } from "fs";
import { PollingOptions } from "node-telegram-bot-api";

import { BotConfig } from "../../config/schema";
import logger from "../../services/logger";
import { fetchWithTimeout } from "../../utils/network";
import HackerEmbassyBot from "../core/HackerEmbassyBot";
import { setMenu } from "./menu";
import { setAutomaticFeatures } from "./recurring-actions";
import { addEventHandlers, addRoutes, startRouting } from "./router";
const botConfig = config.get<BotConfig>("bot");

const POLLING_OPTIONS: PollingOptions = {
    params: {
        // @ts-ignore
        allowed_updates: JSON.stringify([
            "update_id",
            "message",
            "edited_message",
            "channel_post",
            "edited_channel_post",
            "inline_query",
            "chosen_inline_result",
            "callback_query",
            "shipping_query",
            "pre_checkout_query",
            "poll",
            "poll_answer",
            "my_chat_member",
            "chat_member",
        ]),
    },
    autoStart: false,
};

const FAILOVER_MESSAGE = "🆘 Health check failed, doing failover to the slave instance";
const OK_MESSAGE = "🆗 Health check passed, master instance is back online";

function healthCheckMaster(maxRetryCount: number, retryInterval: number) {
    const healthCheckUrl = `https://${botConfig.instance.masterHost}/healthcheck`;

    let failedCount = 0;

    setInterval(async () => {
        try {
            const response = await fetchWithTimeout(healthCheckUrl, { timeout: retryInterval });
            failedCount = 0;

            if (!response.ok) throw new Error(`Health check failed with status ${response.status}`);

            if (bot.isPolling()) {
                bot.sendMessageExt(botConfig.chats.alerts, OK_MESSAGE, null);
                logger.info(OK_MESSAGE);

                bot.stopPolling();
            }
        } catch (e) {
            failedCount++;
            logger.info(`Health check failed ${failedCount} times`);

            if (failedCount >= maxRetryCount && !bot.isPolling()) {
                failedCount = 0;

                bot.startPolling({ polling: POLLING_OPTIONS });

                bot.sendMessageExt(botConfig.chats.alerts, FAILOVER_MESSAGE, null);
                logger.info(FAILOVER_MESSAGE);
            }
        }
    }, retryInterval);
}

async function init(bot: HackerEmbassyBot): Promise<void> {
    const botInstanceInfo = await bot.getMe();
    bot.Name = botInstanceInfo.username;
    const restrictedImage = await fs.readFile("./resources/images/restricted.jpg").catch(() => null);
    bot.restrictedImage = restrictedImage ? Buffer.from(restrictedImage) : null;
    addRoutes(bot);
    addEventHandlers(bot);
    startRouting(bot, botConfig.debug);
    setAutomaticFeatures(bot);
    setMenu(bot);

    if (botConfig.instance.type === "slave") {
        healthCheckMaster(botConfig.instance.maxRetryCount, botConfig.instance.retryInterval);
        logger.info(`Bot started in slave mode, health checking the master instance at ${botConfig.instance.masterHost}`);
    } else {
        bot.startPolling();
        logger.info(`Bot is started in master mode`);
    }
}

// Configure the bot singleton instance
if (!process.env["HACKERBOTTOKEN"]) {
    logger.error("HACKERBOTTOKEN is not defined");
    logger.error("Please set HACKERBOTTOKEN in the .env file or sevironment variables");
    logger.error("Exiting...");
    process.exit(1);
}

const bot = new HackerEmbassyBot(process.env["HACKERBOTTOKEN"], {
    polling: POLLING_OPTIONS,
});

export function StartTelegramBot() {
    init(bot);
}

export default bot;
