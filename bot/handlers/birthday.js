const fs = require("fs/promises");
const path = require("path");
const { sleep } = require("../../utils/common");
const logger = require("../../services/logger");

const UsersRepository = require("../../repositories/usersRepository");
const TextGenerators = require("../../services/textGenerators");
const UsersHelper = require("../../services/usersHelper");
const botConfig = require("config").get("bot");

const wishedTodayPath = "./data/wished-today.json";
const baseWishesDir = "./resources/wishes";
const t = require("../../services/localization");

class BirthdayHandlers {
    static forceBirthdayWishHandler = (bot, msg) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

        this.sendBirthdayWishes(bot, true);
    };

    static birthdayHandler = async (bot, msg) => {
        const usersWithBirthday = UsersRepository.getUsers().filter(u => u.birthday);
        const text = TextGenerators.getBirthdaysList(usersWithBirthday, bot.context.mode);

        await bot.sendMessage(msg.chat.id, text);
    };

    static myBirthdayHandler = (bot, msg, date) => {
        const username = msg.from.username;
        const formattedUsername = UsersHelper.formatUsername(username, bot.context.mode);
        const fulldate = date?.length === 5 ? "0000-" + date : date;

        let text = t("birthday.fail");

        if (this.isProperFormatDateString(date) && UsersRepository.setBirthday(username, fulldate)) {
            text = t("birthday.set", { username: formattedUsername, date });
        } else if (date === "remove" && UsersRepository.setBirthday(username, null)) {
            text = t("birthday.remove", { username: formattedUsername });
        }

        bot.sendMessage(msg.chat.id, text);
    };

    static async sendBirthdayWishes(bot, force = false) {
        let currentDate = new Date().toLocaleDateString("sv").substring(5, 10);
        let birthdayUsers = UsersRepository.getUsers().filter(u => {
            return u.birthday?.substring(5, 10) === currentDate;
        });

        if (await fs.access(wishedTodayPath).catch(() => true)) {
            fs.writeFile(wishedTodayPath, "[]");
        }

        let wishedToday = JSON.parse(await fs.readFile(wishedTodayPath, "utf8"));
        let wishedAmount = wishedToday?.length;

        for (const user of birthdayUsers) {
            let wishedUser = wishedToday.find(entry => entry.username && entry.date === currentDate);
            if (!force && wishedUser) continue;

            let message = "🎂 ";
            message += await getWish(user.username);

            await bot.sendMessage(botConfig.chats.main, message);
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
