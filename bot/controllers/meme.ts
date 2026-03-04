import config from "config";

import { Message } from "node-telegram-bot-api";

import { BotConfig } from "@config";
import { getToday } from "@utils/date";
import { getImageFromPath, getRandomImageFromFolder } from "@utils/filesystem";
import { overlayStaticImageOnGif } from "@utils/image";
import { randomInteger } from "@utils/common";
import { Route } from "@hackembot/core/decorators";
import { userService } from "@services/domain/user";

import HackerEmbassyBot from "../core/classes/HackerEmbassyBot";
import t from "../core/localization";
import { BotController } from "../core/types";
import { effectiveName, formatUsername, getMentions, OptionalParam, userLink } from "../core/helpers";

const botConfig = config.get<BotConfig>("bot");

const ZHABKA_CHANCE = 0.35;
const ZHABKAS_PATH = "./resources/images/toads";
const ITS_WEDNESDAY_YEAAAH = ["𓆏", "𓆏", "𓆏"].length;
const NOT_WEDNESDAY_SAD_IMAGE = "./resources/images/memes/notwednesday.jpg";

export default class MemeController implements BotController {
    static readonly 𓆏 = (𓈝: 𓇍, 𓎶: 𓇝) => (𓁺() === 𓀥 ? 𓉢(𓈝, 𓎶, 𓇠) : 𓉡(𓈝, 𓎶, 𓃾));

    @Route(["randomzhabka", "randomtoad", "zhabka", "zhaba", "toad", "wednesday"], "Get a random zhabka (toad) image!")
    static async randomZhabkaHandler(bot: HackerEmbassyBot, msg: Message) {
        await MemeController.𓆏(bot, msg);
    }

    static async remindItIsWednesdayHandler(bot: HackerEmbassyBot) {
        const msg = await bot.sendMessageExt(botConfig.chats.horny, t("meme.its_wednesday"), null);

        if (msg) await MemeController.randomImagePathHandler(bot, msg, ZHABKAS_PATH);
    }

    @Route(["randomdog", "dog"], "Get a random dog image", null, () => ["./resources/images/dogs"])
    @Route(["randomcat", "cat"], "Get a random cat image", null, () => ["./resources/images/cats"])
    @Route(["randomcock", "cock"], "Get a random cock image", null, () => ["./resources/images/roosters"])
    @Route(["respect", "f"], "Get a random F image", null, () => ["./resources/images/respect"])
    static async randomImagePathHandler(bot: HackerEmbassyBot, msg: Message, path: string) {
        const isTimeForZhabka = getToday().getDay() === ITS_WEDNESDAY_YEAAAH && Math.random() < ZHABKA_CHANCE;
        const buffer = isTimeForZhabka ? await getRandomImageFromFolder(ZHABKAS_PATH) : await getRandomImageFromFolder(path);

        if (!buffer) {
            await bot.sendMessageExt(msg.chat.id, t("status.general.errors.generic"), msg);
            return;
        }

        await bot.sendPhotoExt(msg.chat.id, buffer, msg);
    }

    @Route(["syrniki", "pidarasi", "pidorasi"], "Get a random syrnik", null, () => ["./resources/images/memes/syrniki.jpeg"])
    static async imageHandler(bot: HackerEmbassyBot, msg: Message, path: string) {
        const buffer = await getImageFromPath(path);

        if (!buffer) {
            await bot.sendMessageExt(msg.chat.id, t("status.general.errors.generic"), msg);
            return;
        }

        await bot.sendPhotoExt(msg.chat.id, buffer, msg);
    }

    @Route(["slapp", "slapa", "slapavatar", "slapava", "slapface"], "Slap a user's avatar", OptionalParam(/(\S+)/), match => [
        match[1],
    ])
    static async slapAvatarHandler(bot: HackerEmbassyBot, msg: Message, username?: string) {
        const sender = bot.context(msg).user;
        const targetUser =
            getMentions(msg)[0] ?? (username ? userService.getUser(username.replace("@", "")) : msg.reply_to_message?.from);

        if (!targetUser) return bot.sendMessageExt(msg.chat.id, t("meme.slap.help"), msg);

        const targetId = "userid" in targetUser ? targetUser.userid : targetUser.id;
        const targetName = formatUsername(effectiveName(targetUser), true);
        const userProfilePhotos = await bot.getUserProfilePhotos(targetId, { limit: 1 });

        if (userProfilePhotos.total_count === 0) return bot.sendMessageExt(msg.chat.id, t("meme.slap.no_avatar"), msg);

        bot.sendChatAction(msg.chat.id, "upload_photo", msg);

        const avatarId = userProfilePhotos.photos[0][0].file_id;
        const avatarUrl = await bot.getFileLink(avatarId);
        const gifBuffer = await overlayStaticImageOnGif("./resources/images/animations/slap-0.gif", avatarUrl, {
            overlayWidth: 150,
            overlayX: 135,
            overlayY: 310,
        });

        const caption = t("meme.slap.user", {
            from: userLink(sender),
            target: targetName,
        });

        return bot.sendAnimationExt(msg.chat.id, gifBuffer, msg, { caption });
    }

    @Route(["slap"], "Slap a user", OptionalParam(/(\S+)/), match => [match[1]])
    static async slapHandler(bot: HackerEmbassyBot, msg: Message, username?: string) {
        const sender = bot.context(msg).user;
        const extractedTarget = username ?? effectiveName(msg.reply_to_message?.from);

        if (!extractedTarget) return bot.sendMessageExt(msg.chat.id, t("meme.slap.help"), msg);

        bot.sendChatAction(msg.chat.id, "upload_photo", msg);

        const target = formatUsername(extractedTarget, true);
        const caption = t("meme.slap.user", {
            from: userLink(sender),
            target,
        });

        let source: string;

        switch (target.slice(1)) {
            case bot.name:
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

    // TODO: deduplicate hugHandler and slapHandler
    @Route(["hug"], "Hug a user", OptionalParam(/(\S+)/), match => [match[1]])
    static async hugHandler(bot: HackerEmbassyBot, msg: Message, username?: string) {
        const sender = bot.context(msg).user;
        const extractedTarget = username ?? effectiveName(msg.reply_to_message?.from);

        if (!extractedTarget) return bot.sendMessageExt(msg.chat.id, t("meme.hug.help"), msg);

        const target = formatUsername(extractedTarget, true);
        const caption = t("meme.hug.user", {
            from: userLink(sender),
            target,
        });

        let source: string;

        switch (target.slice(1)) {
            case bot.name:
                source = "./resources/images/animations/hug-bot.gif";
                break;
            case effectiveName(sender):
                source = "./resources/images/animations/hug-self.gif";
                break;
            default:
                source = `./resources/images/animations/hug-${randomInteger(0, 4)}.gif`;
                break;
        }

        const gif = await getImageFromPath(source).catch(() => null);

        if (gif) return bot.sendAnimationExt(msg.chat.id, gif, msg, { caption });

        return bot.sendMessageExt(msg.chat.id, caption, msg);
    }
}

// Legend
const 𓉢 = MemeController.randomImagePathHandler;
const 𓉡 = MemeController.imageHandler;
const 𓁺 = () => getToday().getDay();
const 𓀥 = ITS_WEDNESDAY_YEAAAH;
const 𓇠 = ZHABKAS_PATH;
const 𓃾 = NOT_WEDNESDAY_SAD_IMAGE;
type 𓇍 = HackerEmbassyBot;
type 𓇝 = Message;
