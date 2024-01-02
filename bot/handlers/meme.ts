import config from "config";
import { Message } from "node-telegram-bot-api";

import { BotConfig } from "../../config/schema";
import t from "../../services/localization";
import { getToday } from "../../utils/date";
import { getImageFromPath, getRandomImageFromFolder } from "../../utils/filesystem";
import HackerEmbassyBot from "../core/HackerEmbassyBot";
import { BotHandlers } from "../core/types";

const botConfig = config.get<BotConfig>("bot");

const ZHABKAS_PATH = "./resources/images/toads";
const ITS_WEDNESDAY_YEAAAH = 3;
const ZHABKA_CHANCE = 0.35;

export default class MemeHandlers implements BotHandlers {
    static async remindItIsWednesdayHandler(bot: HackerEmbassyBot) {
        const now = new Date();

        if (now.getDate() === ITS_WEDNESDAY_YEAAAH && now.getHours() < 6) {
            const msg = await bot.sendMessageExt(botConfig.chats.test, t("meme.its_wednesday"), null);
            msg && MemeHandlers.randomImagePathHandler(bot, msg, ZHABKAS_PATH);
        }
    }

    static async randomZhabkaHandler(bot: HackerEmbassyBot, msg: Message) {
        if (getToday().getDate() !== ITS_WEDNESDAY_YEAAAH) {
            await bot.sendMessageExt(msg.chat.id, t("meme.not_wednesday"), msg);
            return;
        }

        await MemeHandlers.randomImagePathHandler(bot, msg, ZHABKAS_PATH);
    }

    static async randomImagePathHandler(bot: HackerEmbassyBot, msg: Message, path: string) {
        const isTimeForZhabka = getToday().getDay() === ITS_WEDNESDAY_YEAAAH && Math.random() < ZHABKA_CHANCE;
        const buffer = isTimeForZhabka ? await getRandomImageFromFolder(ZHABKAS_PATH) : await getRandomImageFromFolder(path);

        if (!buffer) {
            await bot.sendMessageExt(msg.chat.id, t("status.general.error"), msg);
            return;
        }

        await bot.sendPhotoExt(msg.chat.id, buffer, msg);
    }

    static async imageHandler(bot: HackerEmbassyBot, msg: Message, path: string) {
        const buffer = await getImageFromPath(path);

        if (!buffer) {
            await bot.sendMessageExt(msg.chat.id, t("status.general.error"), msg);
            return;
        }

        await bot.sendPhotoExt(msg.chat.id, buffer, msg);
    }
}
