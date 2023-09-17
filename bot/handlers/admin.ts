import config from "config";
import fs from "fs";
import { Message } from "node-telegram-bot-api";
import path from "path";

import { BotConfig } from "../../config/schema";
import UsersRepository from "../../repositories/usersRepository";
import t from "../../services/localization";
import * as UsersHelper from "../../services/usersHelper";
import { lastModifiedFilePath } from "../../utils/filesystem";
import HackerEmbassyBot from "../HackerEmbassyBot";

const botConfig = config.get("bot") as BotConfig;

export default class AdminHandlers {
    static async forwardHandler(bot: HackerEmbassyBot, msg: Message, text: string) {
        await bot.sendMessageExt(botConfig.chats.main, text, msg);
        await bot.sendMessageExt(msg.chat.id, "Message is forwarded", msg);
    }

    static async getLogHandler(bot: HackerEmbassyBot, msg: Message) {
        const logFolderPath = path.join(__dirname, "../..", botConfig.logfolderpath);
        const lastModifiedFile = lastModifiedFilePath(logFolderPath);
        const lastLogFilePath = lastModifiedFile
            ? path.join(__dirname, "../..", botConfig.logfolderpath, lastModifiedFile)
            : undefined;

        if (lastLogFilePath && fs.existsSync(lastLogFilePath)) await bot.sendDocument(msg.chat.id, lastLogFilePath);
    }

    static async getStateHandler(bot: HackerEmbassyBot, msg: Message) {
        const statepath = bot.messageHistory.botState.statepath;

        if (statepath && fs.existsSync(statepath)) await bot.sendDocument(msg.chat.id, statepath);
    }

    static async cleanStateHandler(bot: HackerEmbassyBot, msg: Message) {
        bot.botState.clearState();
        await bot.sendMessageExt(
            msg.chat.id,
            "Cleared the bot persisted state. Message history and Live handlers are removed",
            msg
        );
    }

    static async stopLiveHandler(bot: HackerEmbassyBot, msg: Message) {
        bot.botState.clearLiveHandlers(msg.chat.id);
        await bot.sendMessageExt(msg.chat.id, "Live handlers are removed from this chat", msg);
    }

    static async getUsersHandler(bot: HackerEmbassyBot, msg: Message) {
        const users = UsersRepository.getUsers();
        let userList = "";

        if (users) {
            for (const user of users) {
                userList += `> ${UsersHelper.formatUsername(user.username, bot.context(msg).mode)}
    Roles: ${user.roles}${user.mac ? `\nMAC: ${user.mac}` : ""}${user.birthday ? `\nBirthday: ${user.birthday}` : ""}
    Autoinside: ${user.autoinside ? "on" : "off"}\n`;
            }
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
