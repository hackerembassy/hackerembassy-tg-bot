const path = require("path");
const fs = require("fs");

const UsersRepository = require("../../repositories/usersRepository");
const UsersHelper = require("../../services/usersHelper");
const botConfig = require("config").get("bot");
const t = require("../../services/localization");
const { lastModifiedFilePath } = require("../../utils/filesystem");

class AdminHandlers {
    static async forwardHandler(bot, msg, text) {
        await bot.sendMessage(botConfig.chats.main, text);
        await bot.sendMessage(msg.chat.id, "Message is forwarded");
    }

    static getLogHandler = async (bot, msg) => {
        const logFolderPath = path.join(__dirname, "../..", botConfig.logfolderpath);
        const lastLogFilePath = path.join(__dirname, "../..", botConfig.logfolderpath, lastModifiedFilePath(logFolderPath));

        if (lastLogFilePath && fs.existsSync(lastLogFilePath)) await bot.sendDocument(msg.chat.id, lastLogFilePath);
    };

    static getHistoryHandler = async (bot, msg) => {
        const historypath = bot.messageHistory.historypath;

        if (historypath && fs.existsSync(historypath)) await bot.sendDocument(msg.chat.id, historypath);
    };

    static getUsersHandler = async (bot, msg) => {
        const users = UsersRepository.getUsers();
        let userList = "";
        for (const user of users) {
            userList += `> ${UsersHelper.formatUsername(user.username, bot.context.mode)}
Roles: ${user.roles}${user.mac ? `\nMAC: ${user.mac}` : ""}${user.birthday ? `\nBirthday: ${user.birthday}` : ""}
Autoinside: ${user.autoinside ? "on" : "off"}\n`;
        }

        await bot.sendLongMessage(msg.chat.id, t("admin.getUsers.text") + userList);
    };

    static addUserHandler = async (bot, msg, username, roles) => {
        username = username.replace("@", "");
        roles = roles.split("|");

        const success = UsersRepository.addUser(username, roles);
        const text = success
            ? t("admin.addUser.success", { username: UsersHelper.formatUsername(username, bot.context.mode), roles })
            : t("admin.addUser.fail");

        await bot.sendMessage(msg.chat.id, text);
    };

    static updateRolesHandler = async (bot, msg, username, roles) => {
        username = username.replace("@", "");
        roles = roles.split("|");

        const success = UsersRepository.updateRoles(username, roles);
        const text = success
            ? t("admin.updateRoles.success", { username: UsersHelper.formatUsername(username, bot.context.mode), roles })
            : t("admin.updateRoles.fail");

        await bot.sendMessage(msg.chat.id, text);
    };

    static removeUserHandler = async (bot, msg, username) => {
        username = username.replace("@", "");

        const success = UsersRepository.removeUser(username);
        const text = success
            ? t("admin.removeUser.success", { username: UsersHelper.formatUsername(username, bot.context.mode) })
            : t("admin.removeUser.fail");

        await bot.sendMessage(msg.chat.id, text);
    };
}

module.exports = AdminHandlers;
