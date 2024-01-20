import config from "config";
import fs from "fs/promises";
import { Message } from "node-telegram-bot-api";
import path from "path";

import { BotConfig } from "../../config/schema";
import UsersRepository from "../../repositories/usersRepository";
import t from "../../services/localization";
import logger from "../../services/logger";
import * as TextGenerators from "../../services/textGenerators";
import { sleep } from "../../utils/common";
import { hasBirthdayToday, isToday, MINUTE } from "../../utils/date";
import HackerEmbassyBot from "../core/HackerEmbassyBot";
import { BotHandlers } from "../core/types";
import * as helpers from "../helpers";

const botConfig = config.get<BotConfig>("bot");

const baseWishesDir = "./resources/wishes";

export default class BirthdayHandlers implements BotHandlers {
    static forceBirthdayWishHandler(bot: HackerEmbassyBot, msg: Message) {
        BirthdayHandlers.sendBirthdayWishes(bot, msg, true);
    }

    static async birthdayHandler(bot: HackerEmbassyBot, msg: Message) {
        const usersWithBirthday = UsersRepository.getUsers().filter(u => u.birthday);
        const text = TextGenerators.getBirthdaysList(usersWithBirthday, bot.context(msg).mode);

        await bot.sendMessageExt(msg.chat.id, text, msg);
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

        for (const user of birthdayUsers) {
            const wish = await getWish(user.username ?? "[no username provided]");
            const message = `🎂 ${wish}`;

            await bot.sendMessageExt(botConfig.chats.main, message, msg);

            logger.info(`Wished ${user.username} a happy birthday`);
            await sleep(MINUTE);
        }

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

    return wishTemplate.replaceAll(/\$username/g, `@${username}`);
}
