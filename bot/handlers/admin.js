const path = require("path");
const fs = require("fs");

const UsersRepository = require("../../repositories/usersRepository");
const UsersHelper = require("../../services/usersHelper");
const botConfig = require("config").get("bot");

class AdminHandlers {
    static forwardHandler(bot, msg, text) {
        if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

        bot.sendMessage(botConfig.chats.main, text);
    }

    static getLogHandler = (bot, msg) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

        let logpath = path.join(__dirname, "../..", botConfig.logpath);

        if (fs.existsSync(logpath)) bot.sendDocument(msg.chat.id, logpath);
    };

    static getUsersHandler = (bot, msg) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

        let users = UsersRepository.getUsers();
        let userList = "";
        for (const user of users) {
            userList += `> ${UsersHelper.formatUsername(user.username, bot.mode)}
Roles: ${user.roles}${user.mac ? `\nMAC: ${user.mac}` : ""}${user.birthday ? `\nBirthday: ${user.birthday}` : ""}
Autoinside: ${user.autoinside ? "on" : "off"}\n`;
        }

        bot.sendLongMessage(msg.chat.id, `👩‍💻 Текущие пользователи:\n` + userList);
    };

    static addUserHandler = (bot, msg, username, roles) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

        username = username.replace("@", "");
        roles = roles.split("|");

        let success = UsersRepository.addUser(username, roles);
        let message = success
            ? `✅ Пользователь ${UsersHelper.formatUsername(username, bot.mode)} добавлен как ${roles}`
            : `⚠️ Не удалось добавить пользователя (может он уже есть?)`;

        bot.sendMessage(msg.chat.id, message);
    };

    static updateRolesHandler = (bot, msg, username, roles) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

        username = username.replace("@", "");
        roles = roles.split("|");

        let success = UsersRepository.updateRoles(username, roles);
        let message = success
            ? `✳️ Роли ${UsersHelper.formatUsername(username, bot.mode)} установлены как ${roles}`
            : `⚠️ Не удалось обновить роли`;

        bot.sendMessage(msg.chat.id, message);
    };

    static removeUserHandler = (bot, msg, username) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

        username = username.replace("@", "");

        let success = UsersRepository.removeUser(username);
        let message = success
            ? `🗑 Пользователь ${UsersHelper.formatUsername(username, bot.mode)} удален`
            : `⚠️ Не удалось удалить пользователя (может его и не было?)`;

        bot.sendMessage(msg.chat.id, message);
    };
}

module.exports = AdminHandlers;
