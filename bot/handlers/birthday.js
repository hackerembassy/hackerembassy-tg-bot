const fs = require("fs/promises");
const path = require("path");
const { sleep } = require("../../utils/common");
const logger = require("../../services/logger");

const UsersRepository = require("../../repositories/usersRepository");
const TextGenerators = require("../../services/textGenerators");
const UsersHelper = require("../../services/usersHelper");
const botConfig = require("config").get("bot");

const baseWishesDir = "./resources/wishes";
const wishedTodayPath = "./data/wished-today.json";

class BirthdayHandlers {
    static forceBirthdayWishHandler = (bot, msg) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

        this.sendBirthdayWishes(bot, true);
    };

    static birthdayHandler = (bot, msg) => {
        let birthdayUsers = UsersRepository.getUsers().filter(u => u.birthday);
        let message = TextGenerators.getBirthdaysList(birthdayUsers, bot.mode);

        bot.sendMessage(msg.chat.id, message);
    };

    static myBirthdayHandler = (bot, msg, date) => {
        let message = `🛂 Укажите дату в формате #\`YYYY-MM-DD#\`, #\`MM-DD#\` или укажите #\`remove#\``;
        let username = msg.from.username;

        if (/^(?:\d{4}-)?(0[1-9]|1[0-2])-(0[1-9]|[1-2]\d|3[0-1])$/.test(date)) {
            let fulldate = date.length === 5 ? "0000-" + date : date;
            if (UsersRepository.setBirthday(username, fulldate))
                message = `🎂 День рождения ${UsersHelper.formatUsername(username, bot.mode)} установлен как ${date}`;
        } else if (date === "remove") {
            if (UsersRepository.setBirthday(username, null))
                message = `🎂 День рождения ${UsersHelper.formatUsername(username, bot.mode)} сброшен`;
        }

        bot.sendMessage(msg.chat.id, message);
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

            bot.sendMessage(botConfig.chats.main, message);
            logger.info(`Wished ${user.username} a happy birthday`);

            if (!wishedUser) wishedToday.push({ username: user.username, date: currentDate });

            sleep(30000);
        }

        if (wishedAmount !== wishedToday.length) fs.writeFile(wishedTodayPath, JSON.stringify(wishedToday));
    }
}

async function getWish(username) {
    let files = await fs.readdir(baseWishesDir);
    let randomNum = Math.floor(Math.random() * files.length);
    let wishTemplate = await fs.readFile(path.join(baseWishesDir, files[randomNum]), { encoding: "utf8" });

    return wishTemplate.replaceAll(/\$username/g, `@${username}`);
}

module.exports = BirthdayHandlers;
