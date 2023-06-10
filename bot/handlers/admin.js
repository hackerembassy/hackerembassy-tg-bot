const UsersRepository = require("../../repositories/usersRepository");
const UsersHelper = require("../../services/usersHelper");
const BaseHandlers = require("./base");
const config = require("config");
const botConfig = config.get("bot");
const path = require("path");
const fs = require("fs");

class AdminHandlers extends BaseHandlers {
    constructor() {
        super();
    }

    forwardHandler(msg, text) {
        if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

        this.bot.sendMessage(botConfig.chats.main, text);
    }

    getLogHandler = (msg) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

        let logpath = path.join(__dirname, "../..", botConfig.logpath);

        if (fs.existsSync(logpath)) this.bot.sendDocument(msg.chat.id, logpath);
    };

    getUsersHandler = (msg) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

        let users = UsersRepository.getUsers();
        let userList = "";
        for (const user of users) {
            userList += `> ${this.bot.formatUsername(user.username)}
Roles: ${user.roles}${user.mac ? `\nMAC: ${user.mac}` : ""}${user.birthday ? `\nBirthday: ${user.birthday}` : ""}
Autoinside: ${user.autoinside ? "on" : "off"}\n`;
        }

        this.bot.sendLongMessage(msg.chat.id, `👩‍💻 Текущие пользователи:\n` + userList);
    };

    addUserHandler = (msg, username, roles) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

        username = username.replace("@", "");
        roles = roles.split("|");

        let success = UsersRepository.addUser(username, roles);
        let message = success
            ? `✅ Пользователь ${this.bot.formatUsername(username)} добавлен как ${roles}`
            : `⚠️ Не удалось добавить пользователя (может он уже есть?)`;

        this.bot.sendMessage(msg.chat.id, message);
    };

    updateRolesHandler = (msg, username, roles) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

        username = username.replace("@", "");
        roles = roles.split("|");

        let success = UsersRepository.updateRoles(username, roles);
        let message = success
            ? `✳️ Роли ${this.bot.formatUsername(username)} установлены как ${roles}`
            : `⚠️ Не удалось обновить роли`;

        this.bot.sendMessage(msg.chat.id, message);
    };

    removeUserHandler = (msg, username) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin")) return;

        username = username.replace("@", "");

        let success = UsersRepository.removeUser(username);
        let message = success
            ? `🗑 Пользователь ${this.bot.formatUsername(username)} удален`
            : `⚠️ Не удалось удалить пользователя (может его и не было?)`;

        this.bot.sendMessage(msg.chat.id, message);
    };
}

module.exports = AdminHandlers;
