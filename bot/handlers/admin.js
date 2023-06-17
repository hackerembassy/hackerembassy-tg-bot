const path = require("path");
const fs = require("fs");

const UsersRepository = require("../../repositories/usersRepository");
const UsersHelper = require("../../services/usersHelper");
const botConfig = require("config").get("bot");
const t = require("../../services/localization");

class AdminHandlers {
    static forwardHandler(bot, msg, text) {
        if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

        bot.sendMessage(botConfig.chats.main, text);
    }

    static getLogHandler = (bot, msg) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

        const logpath = path.join(__dirname, "../..", botConfig.logpath);

        if (fs.existsSync(logpath)) bot.sendDocument(msg.chat.id, logpath);
    };

    static getUsersHandler = (bot, msg) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

        const users = UsersRepository.getUsers();
        let userList = "";
        for (const user of users) {
            userList += `> ${UsersHelper.formatUsername(user.username, bot.mode)}
Roles: ${user.roles}${user.mac ? `\nMAC: ${user.mac}` : ""}${user.birthday ? `\nBirthday: ${user.birthday}` : ""}
Autoinside: ${user.autoinside ? "on" : "off"}\n`;
        }

        bot.sendLongMessage(msg.chat.id, t("admin.getUsers.text") + userList);
    };

    static addUserHandler = (bot, msg, username, roles) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

        username = username.replace("@", "");
        roles = roles.split("|");

        const success = UsersRepository.addUser(username, roles);
        const text = success
            ? t("admin.addUser.success", { username: UsersHelper.formatUsername(username, bot.mode), roles })
            : t("admin.addUser.fail");

        bot.sendMessage(msg.chat.id, text);
    };

    static updateRolesHandler = (bot, msg, username, roles) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

        username = username.replace("@", "");
        roles = roles.split("|");

        const success = UsersRepository.updateRoles(username, roles);
        const text = success
            ? t("admin.updateRoles.success", { username: UsersHelper.formatUsername(username, bot.mode), roles })
            : t("admin.updateRoles.fail");

        bot.sendMessage(msg.chat.id, text);
    };

    static removeUserHandler = (bot, msg, username) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

        username = username.replace("@", "");

        const success = UsersRepository.removeUser(username);
        const text = success
            ? t("admin.removeUser.success", { username: UsersHelper.formatUsername(username, bot.mode) })
            : t("admin.removeUser.fail");

        bot.sendMessage(msg.chat.id, text);
    };
}

module.exports = AdminHandlers;
