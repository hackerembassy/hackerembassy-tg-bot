import fs from "fs/promises";
import path from "path";

import config from "config";
import { Message } from "node-telegram-bot-api";

import { BotConfig } from "@config";
import UsersRepository from "@repositories/users";
import { hasBirthdayToday, isToday, MINUTE } from "@utils/date";

import HackerEmbassyBot from "../core/HackerEmbassyBot";
import { ButtonFlags, InlineButton } from "../core/InlineButtons";
import t from "../core/localization";
import { RateLimiter } from "../core/RateLimit";
import { BotHandlers } from "../core/types";
import * as helpers from "../helpers";
import * as TextGenerators from "../textGenerators";

const botConfig = config.get<BotConfig>("bot");

const baseWishesDir = "./resources/wishes";

export default class BirthdayHandlers implements BotHandlers {
    static forceBirthdayWishHandler(bot: HackerEmbassyBot, msg: Message) {
        BirthdayHandlers.sendBirthdayWishes(bot, msg, true);
    }

    static async birthdayHandler(bot: HackerEmbassyBot, msg: Message) {
        const usersWithBirthday = UsersRepository.getUsers().filter(u => u.birthday);
        const text = TextGenerators.getBirthdaysList(usersWithBirthday, bot.context(msg).mode);

        const inline_keyboard = [[InlineButton(t("general.buttons.menu"), "startpanel", ButtonFlags.Editing)]];

        await bot.sendOrEditMessage(
            msg.chat.id,
            text,
            msg,
            {
                reply_markup: {
                    inline_keyboard,
                },
            },
            msg.message_id
        );
    }

    static myBirthdayHandler(bot: HackerEmbassyBot, msg: Message, date?: string) {
        const username = msg.from?.username;
        const formattedUsername = helpers.formatUsername(username, bot.context(msg).mode);
        const fulldate = date?.length === 5 ? "0000-" + date : date;

        let text = t("birthday.fail");

        if (BirthdayHandlers.isAllowedFormatDateString(date) && username && UsersRepository.setBirthday(username, fulldate)) {
            text = t("birthday.set", { username: formattedUsername, date });
        } else if (date === "remove" && username && UsersRepository.setBirthday(username, null)) {
            text = t("birthday.remove", { username: formattedUsername });
        }

        bot.sendMessageExt(msg.chat.id, text, msg);
    }

    static async sendBirthdayWishes(bot: HackerEmbassyBot, msg: Nullable<Message>, force: boolean = false) {
        const birthdayUsers = UsersRepository.getUsers().filter(u => u.username && hasBirthdayToday(u.birthday));

        if (!force && isToday(new Date(bot.botState.lastBirthdayWishTimestamp), true)) return;

        if (birthdayUsers.length === 0) return;

        await RateLimiter.executeOverTime(
            birthdayUsers.map(
                u => async () =>
                    bot.sendMessageExt(botConfig.chats.main, await getWish(u.username ?? "[no username provided]"), msg)
            ),
            MINUTE
        );

        bot.botState.lastBirthdayWishTimestamp = Date.now();
        bot.botState.persistChanges();
    }

    static isAllowedFormatDateString(date?: string) {
        return date ? /^(?:\d{4}-)?(0[1-9]|1[0-2])-(0[1-9]|[1-2]\d|3[0-1])$/.test(date) : false;
    }
}

async function getWish(username: string) {
    const files = await fs.readdir(baseWishesDir);
    const randomNum = Math.floor(Math.random() * files.length);
    const wishTemplate = await fs.readFile(path.join(baseWishesDir, files[randomNum]), { encoding: "utf8" });

    return `🎂 ${wishTemplate.replaceAll(/\$username/g, `@${username}`)}`;
}
