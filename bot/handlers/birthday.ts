import config from "config";
import fs from "fs/promises";
import { Message } from "node-telegram-bot-api";
import path from "path";

import { BotConfig } from "../../config/schema";
import UsersRepository from "../../repositories/usersRepository";
import t from "../../services/localization";
import logger from "../../services/logger";
import * as TextGenerators from "../../services/textGenerators";
import * as UsersHelper from "../../services/usersHelper";
import { sleep } from "../../utils/common";
import HackerEmbassyBot, { BotHandlers } from "../HackerEmbassyBot";

const botConfig = config.get<BotConfig>("bot");

const wishedTodayPath = path.join(__dirname, `../../${botConfig.persistedfolderpath}/wished-today.json`);
const baseWishesDir = "./resources/wishes";

export default class BirthdayHandlers implements BotHandlers {
    static forceBirthdayWishHandler(bot: HackerEmbassyBot, msg: Message) {
        BirthdayHandlers.sendBirthdayWishes(bot, msg, true);
    }

    static async birthdayHandler(bot: HackerEmbassyBot, msg: Message) {
        const usersWithBirthday = UsersRepository.getUsers()?.filter(u => u.birthday);
        const text = TextGenerators.getBirthdaysList(usersWithBirthday, bot.context(msg).mode);

        await bot.sendMessageExt(msg.chat.id, text, msg);
    }

    static myBirthdayHandler(bot: HackerEmbassyBot, msg: Message, date?: string) {
        const username = msg.from?.username;
        const formattedUsername = UsersHelper.formatUsername(username, bot.context(msg).mode);
        const fulldate = date?.length === 5 ? "0000-" + date : date;

        let text = t("birthday.fail");

        if (BirthdayHandlers.isProperFormatDateString(date) && username && UsersRepository.setBirthday(username, fulldate)) {
            text = t("birthday.set", { username: formattedUsername, date });
        } else if (date === "remove" && username && UsersRepository.setBirthday(username, null)) {
            text = t("birthday.remove", { username: formattedUsername });
        }

        bot.sendMessageExt(msg.chat.id, text, msg);
    }

    static async sendBirthdayWishes(bot: HackerEmbassyBot, msg: Nullable<Message>, force = false) {
        const currentDate = new Date().toLocaleDateString("sv").substring(5, 10);
        const birthdayUsers = UsersRepository.getUsers()?.filter(u => {
            return u.birthday?.substring(5, 10) === currentDate;
        });

        if (!birthdayUsers) return;

        if (await fs.access(wishedTodayPath).catch(() => true)) {
            await fs.writeFile(wishedTodayPath, "[]");
        }

        const wishedToday = JSON.parse(await fs.readFile(wishedTodayPath, "utf8"));
        const wishedAmount = wishedToday?.length;

        for (const user of birthdayUsers) {
            const wishedUser = wishedToday.find(
                (entry: { username: string; date: string }) => entry.username && entry.date === currentDate
            );
            if (!force && wishedUser) continue;

            let message = "🎂 ";
            message += await getWish(user.username ?? "[no username provided]");

            await bot.sendMessageExt(botConfig.chats.main, message, msg);
            logger.info(`Wished ${user.username} a happy birthday`);

            if (!wishedUser) wishedToday.push({ username: user.username, date: currentDate });

            sleep(30000);
        }

        if (wishedAmount !== wishedToday.length) fs.writeFile(wishedTodayPath, JSON.stringify(wishedToday));
    }

    static isProperFormatDateString(date?: string) {
        return date ? /^(?:\d{4}-)?(0[1-9]|1[0-2])-(0[1-9]|[1-2]\d|3[0-1])$/.test(date) : false;
    }
}

async function getWish(username: string) {
    const files = await fs.readdir(baseWishesDir);
    const randomNum = Math.floor(Math.random() * files.length);
    const wishTemplate = await fs.readFile(path.join(baseWishesDir, files[randomNum]), { encoding: "utf8" });

    return wishTemplate.replaceAll(/\$username/g, `@${username}`);
}
