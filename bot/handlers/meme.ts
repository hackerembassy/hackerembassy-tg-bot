import config from "config";

import { Message } from "node-telegram-bot-api";

import { BotConfig } from "@config";
import { getToday } from "@utils/date";
import { getImageFromPath, getRandomImageFromFolder } from "@utils/filesystem";
import { randomInteger } from "@utils/common";

import HackerEmbassyBot from "../core/HackerEmbassyBot";
import t from "../core/localization";
import { BotHandlers } from "../core/types";
import { effectiveName, formatUsername, userLink } from "../core/helpers";

const botConfig = config.get<BotConfig>("bot");

const ZHABKA_CHANCE = 0.35;
const ZHABKAS_PATH = "./resources/images/toads";
const ITS_WEDNESDAY_YEAAAH = ["𓆏", "𓆏", "𓆏"].length;

export default class MemeHandlers implements BotHandlers {
    static 𓆏 = (𓈝: 𓇍, 𓎶: 𓇝) => (𓁺() === 𓀥 ? 𓉢(𓈝, 𓎶, 𓇠) : 𓈝[𓈴](𓎶[𓁪𓁫][𓁷], 𓆲(𓃾), 𓎶));

    static async randomZhabkaHandler(bot: HackerEmbassyBot, msg: Message) {
        await MemeHandlers.𓆏(bot, msg);
    }

    static async remindItIsWednesdayHandler(bot: HackerEmbassyBot) {
        const now = new Date();

        if (now.getDay() === ITS_WEDNESDAY_YEAAAH && now.getHours() < 6) {
            const msg = await bot.sendMessageExt(botConfig.chats.horny, t("meme.its_wednesday"), null);
            msg && MemeHandlers.randomImagePathHandler(bot, msg, ZHABKAS_PATH);
        }
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

    static async slapHandler(bot: HackerEmbassyBot, msg: Message, username?: string) {
        const sender = bot.context(msg).user;
        const extractedTarget = username ?? effectiveName(msg.reply_to_message?.from);

        if (!extractedTarget) return bot.sendMessageExt(msg.chat.id, t("meme.slap.help"), msg);

        const target = formatUsername(extractedTarget, { mention: true });
        const caption = t("meme.slap.user", {
            from: userLink(sender),
            target,
        });

        let source: string;

        switch (target.slice(1)) {
            case bot.Name:
                source = "./resources/images/animations/slap-bot.gif";
                break;
            case "korn9509":
                source = "./resources/images/animations/slap-korn.gif";
                break;
            case effectiveName(sender):
                source = "./resources/images/animations/slap-self.gif";
                break;
            default:
                source = `./resources/images/animations/slap-${Math.random() < 0.5 ? 0 : randomInteger(0, 6)}.gif`;
                break;
        }

        const gif = await getImageFromPath(source).catch(() => null);

        if (gif) return bot.sendAnimationExt(msg.chat.id, gif, msg, { caption });

        return bot.sendMessageExt(msg.chat.id, caption, msg);
    }
}

// Legend
const 𓉢 = MemeHandlers.randomImagePathHandler;
const 𓁺 = () => getToday().getDay();
const 𓀥 = ITS_WEDNESDAY_YEAAAH;
const 𓇠 = ZHABKAS_PATH;
const 𓆲 = t;
const 𓈴 = "sendMessageExt";
const 𓁪𓁫 = "chat";
const 𓁷 = "id";
const 𓃾 = "meme.not_wednesday";
type 𓇍 = HackerEmbassyBot;
type 𓇝 = Message;
