const path = require("path");
const fs = require("fs");

const UsersRepository = require("../../repositories/usersRepository");
const UsersHelper = require("../../services/usersHelper");
const botConfig = require("config").get("bot");
const t = require("../../services/localization");
const { lastModifiedFilePath } = require("../../utils/filesystem");

/**
 * @typedef {import("../HackerEmbassyBot").HackerEmbassyBot} HackerEmbassyBot
 * @typedef {import("node-telegram-bot-api").Message} Message
 */

class AdminHandlers {
    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     * @param {string} text
     */
    static async forwardHandler(bot, msg, text) {
        await bot.sendMessageExt(botConfig.chats.main, text, msg);
        await bot.sendMessageExt(msg.chat.id, "Message is forwarded", msg);
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async getLogHandler(bot, msg) {
        const logFolderPath = path.join(__dirname, "../..", botConfig.logfolderpath);
        const lastLogFilePath = path.join(__dirname, "../..", botConfig.logfolderpath, lastModifiedFilePath(logFolderPath));

        if (lastLogFilePath && fs.existsSync(lastLogFilePath)) await bot.sendDocument(msg.chat.id, lastLogFilePath);
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async getHistoryHandler(bot, msg) {
        const historypath = bot.messageHistory.historypath;

        if (historypath && fs.existsSync(historypath)) await bot.sendDocument(msg.chat.id, historypath);
    }
    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async getUsersHandler(bot, msg) {
        const users = UsersRepository.getUsers();
        let userList = "";
        for (const user of users) {
            userList += `> ${UsersHelper.formatUsername(user.username, bot.context(msg).mode)}
Roles: ${user.roles}${user.mac ? `\nMAC: ${user.mac}` : ""}${user.birthday ? `\nBirthday: ${user.birthday}` : ""}
Autoinside: ${user.autoinside ? "on" : "off"}\n`;
        }

        await bot.sendLongMessage(msg.chat.id, t("admin.getUsers.text") + userList, msg);
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async addUserHandler(bot, msg, username, roles) {
        username = username.replace("@", "");
        roles = roles.split("|");

        const success = UsersRepository.addUser(username, roles);
        const text = success
            ? t("admin.addUser.success", { username: UsersHelper.formatUsername(username, bot.context(msg).mode), roles })
            : t("admin.addUser.fail");

        await bot.sendMessageExt(msg.chat.id, text, msg);
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async updateRolesHandler(bot, msg, username, roles) {
        username = username.replace("@", "");
        roles = roles.split("|");

        const success = UsersRepository.updateRoles(username, roles);
        const text = success
            ? t("admin.updateRoles.success", { username: UsersHelper.formatUsername(username, bot.context(msg).mode), roles })
            : t("admin.updateRoles.fail");

        await bot.sendMessageExt(msg.chat.id, text, msg);
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async removeUserHandler(bot, msg, username) {
        username = username.replace("@", "");

        const success = UsersRepository.removeUser(username);
        const text = success
            ? t("admin.removeUser.success", { username: UsersHelper.formatUsername(username, bot.context(msg).mode) })
            : t("admin.removeUser.fail");

        await bot.sendMessageExt(msg.chat.id, text, msg);
    }
}

module.exports = AdminHandlers;
