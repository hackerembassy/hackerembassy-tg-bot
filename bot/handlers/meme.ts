import { Message } from "node-telegram-bot-api";

import t from "../../services/localization";
import { getImageFromPath, getRandomImageFromFolder } from "../../utils/filesystem";
import HackerEmbassyBot from "../core/HackerEmbassyBot";
import { BotHandlers } from "../core/types";

export default class MemeHandlers implements BotHandlers {
    static async randomImagePathHandler(bot: HackerEmbassyBot, msg: Message, path: string) {
        const buffer = await getRandomImageFromFolder(path);

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
