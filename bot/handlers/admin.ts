import { Message } from "node-telegram-bot-api";
import HackerEmbassyBot from "../HackerEmbassyBot";

import path from "path";
import fs from "fs";

import UsersRepository from "../../repositories/usersRepository";
import * as UsersHelper from "../../services/usersHelper";
import config from "config";

const botConfig = config.get("bot") as any;
import t from "../../services/localization";
import { lastModifiedFilePath } from "../../utils/filesystem";

export default class AdminHandlers {
    static async forwardHandler(bot: HackerEmbassyBot, msg: Message, text: string) {
        await bot.sendMessageExt(botConfig.chats.main, text, msg);
        await bot.sendMessageExt(msg.chat.id, "Message is forwarded", msg);
    }

    static async getLogHandler(bot: HackerEmbassyBot, msg: Message) {
        const logFolderPath = path.join(__dirname, "../..", botConfig.logfolderpath);
        const lastLogFilePath = path.join(__dirname, "../..", botConfig.logfolderpath, lastModifiedFilePath(logFolderPath));

        if (lastLogFilePath && fs.existsSync(lastLogFilePath)) await bot.sendDocument(msg.chat.id, lastLogFilePath);
    }

    static async getHistoryHandler(bot: HackerEmbassyBot, msg: Message) {
        const historypath = bot.messageHistory.historypath;

        if (historypath && fs.existsSync(historypath)) await bot.sendDocument(msg.chat.id, historypath);
    }

    static async getUsersHandler(bot: HackerEmbassyBot, msg: Message) {
        const users = UsersRepository.getUsers();
        let userList = "";
        for (const user of users) {
            userList += `> ${UsersHelper.formatUsername(user.username, bot.context(msg).mode)}
Roles: ${user.roles}${user.mac ? `\nMAC: ${user.mac}` : ""}${user.birthday ? `\nBirthday: ${user.birthday}` : ""}
Autoinside: ${user.autoinside ? "on" : "off"}\n`;
        }

        await bot.sendLongMessage(msg.chat.id, t("admin.getUsers.text") + userList, msg);
    }

    static async addUserHandler(bot: HackerEmbassyBot, msg: Message, username: string, rolesString: string) {
        username = username.replace("@", "");
        const roles = rolesString.split("|");

        const success = UsersRepository.addUser(username, roles);
        const text = success
            ? t("admin.addUser.success", { username: UsersHelper.formatUsername(username, bot.context(msg).mode), roles })
            : t("admin.addUser.fail");

        await bot.sendMessageExt(msg.chat.id, text, msg);
    }

    static async updateRolesHandler(bot: HackerEmbassyBot, msg: Message, username: string, rolesString: string) {
        username = username.replace("@", "");
        const roles = rolesString.split("|");

        const success = UsersRepository.updateRoles(username, roles);
        const text = success
            ? t("admin.updateRoles.success", { username: UsersHelper.formatUsername(username, bot.context(msg).mode), roles })
            : t("admin.updateRoles.fail");

        await bot.sendMessageExt(msg.chat.id, text, msg);
    }

    static async removeUserHandler(bot: HackerEmbassyBot, msg: Message, username: string) {
        username = username.replace("@", "");

        const success = UsersRepository.removeUser(username);
        const text = success
            ? t("admin.removeUser.success", { username: UsersHelper.formatUsername(username, bot.context(msg).mode) })
            : t("admin.removeUser.fail");

        await bot.sendMessageExt(msg.chat.id, text, msg);
    }
}
