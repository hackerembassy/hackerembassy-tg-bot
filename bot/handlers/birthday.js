const fs = require("fs/promises");
const path = require("path");
const { sleep } = require("../../utils/common");
const logger = require("../../services/logger");

const UsersRepository = require("../../repositories/usersRepository");
const TextGenerators = require("../../services/textGenerators");
const UsersHelper = require("../../services/usersHelper");
const botConfig = require("config").get("bot");

const wishedTodayPath = path.join(__dirname, `../../${botConfig.persistedfolderpath}/wished-today.json`);
const baseWishesDir = "./resources/wishes";
const t = require("../../services/localization");

/**
 * @typedef {import("../HackerEmbassyBot").HackerEmbassyBot} HackerEmbassyBot
 * @typedef {import("node-telegram-bot-api").Message} Message
 */

class BirthdayHandlers {
    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async forceBirthdayWishHandler(bot, msg) {
        this.sendBirthdayWishes(bot, msg, true);
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async birthdayHandler(bot, msg) {
        const usersWithBirthday = UsersRepository.getUsers().filter(u => u.birthday);
        const text = TextGenerators.getBirthdaysList(usersWithBirthday, bot.context(msg).mode);

        await bot.sendMessageExt(msg.chat.id, text, msg);
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async myBirthdayHandler(bot, msg, date) {
        const username = msg.from.username;
        const formattedUsername = UsersHelper.formatUsername(username, bot.context(msg).mode);
        const fulldate = date?.length === 5 ? "0000-" + date : date;

        let text = t("birthday.fail");

        if (this.isProperFormatDateString(date) && UsersRepository.setBirthday(username, fulldate)) {
            text = t("birthday.set", { username: formattedUsername, date });
        } else if (date === "remove" && UsersRepository.setBirthday(username, null)) {
            text = t("birthday.remove", { username: formattedUsername });
        }

        bot.sendMessageExt(msg.chat.id, text, msg);
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async sendBirthdayWishes(bot, msg, force = false) {
        let currentDate = new Date().toLocaleDateString("sv").substring(5, 10);
        let birthdayUsers = UsersRepository.getUsers().filter(u => {
            return u.birthday?.substring(5, 10) === currentDate;
        });

        if (await fs.access(wishedTodayPath).catch(() => true)) {
            await fs.writeFile(wishedTodayPath, "[]");
        }

        let wishedToday = JSON.parse(await fs.readFile(wishedTodayPath, "utf8"));
        let wishedAmount = wishedToday?.length;

        for (const user of birthdayUsers) {
            let wishedUser = wishedToday.find(entry => entry.username && entry.date === currentDate);
            if (!force && wishedUser) continue;

            let message = "🎂 ";
            message += await getWish(user.username);

            await bot.sendMessageExt(botConfig.chats.main, message, msg);
            logger.info(`Wished ${user.username} a happy birthday`);

            if (!wishedUser) wishedToday.push({ username: user.username, date: currentDate });

            sleep(30000);
        }

        if (wishedAmount !== wishedToday.length) fs.writeFile(wishedTodayPath, JSON.stringify(wishedToday));
    }

    /**
     * @param {string} date
     */
    static isProperFormatDateString(date) {
        return /^(?:\d{4}-)?(0[1-9]|1[0-2])-(0[1-9]|[1-2]\d|3[0-1])$/.test(date);
    }
}

async function getWish(username) {
    let files = await fs.readdir(baseWishesDir);
    let randomNum = Math.floor(Math.random() * files.length);
    let wishTemplate = await fs.readFile(path.join(baseWishesDir, files[randomNum]), { encoding: "utf8" });

    return wishTemplate.replaceAll(/\$username/g, `@${username}`);
}

module.exports = BirthdayHandlers;
