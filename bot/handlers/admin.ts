import config from "config";
import fs from "fs";
import { Message } from "node-telegram-bot-api";
import path from "path";

import { BotConfig } from "../../config/schema";
import UsersRepository from "../../repositories/usersRepository";
import t from "../../services/localization";
import { lastModifiedFilePath } from "../../utils/filesystem";
import { StateFlags } from "../core/BotState";
import HackerEmbassyBot from "../core/HackerEmbassyBot";
import { BotCustomEvent, BotHandlers } from "../core/types";
import * as helpers from "../helpers";

const botConfig = config.get<BotConfig>("bot");

export default class AdminHandlers implements BotHandlers {
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

    // TODO remove when events are attached to the handler
    static eventCommandMap = {
        [BotCustomEvent.statusLive]: BotCustomEvent.statusLive,
        [BotCustomEvent.camLive]: BotCustomEvent.camLive,
        status: BotCustomEvent.statusLive,
        s: BotCustomEvent.statusLive,
        ss: BotCustomEvent.statusLive,
        webcam: BotCustomEvent.camLive,
        downstairs: BotCustomEvent.camLive,
        webcam2: BotCustomEvent.camLive,
        upstairs: BotCustomEvent.camLive,
        printerscam: BotCustomEvent.camLive,
        downstairs2: BotCustomEvent.camLive,
        doorcam: BotCustomEvent.camLive,
        webcum: BotCustomEvent.camLive,
        webcum2: BotCustomEvent.camLive,
        doorcum: BotCustomEvent.camLive,
        outdoors: BotCustomEvent.camLive,
        kitchen: BotCustomEvent.camLive,
        cam: BotCustomEvent.camLive,
        cam2: BotCustomEvent.camLive,
        cum: BotCustomEvent.camLive,
        cum2: BotCustomEvent.camLive,
        ff: BotCustomEvent.camLive,
        sf: BotCustomEvent.camLive,
        dc: BotCustomEvent.camLive,
    };

    static async stopLiveHandler(bot: HackerEmbassyBot, msg: Message, event?: string) {
        const customEvent = AdminHandlers.eventCommandMap[event as keyof typeof this.eventCommandMap];
        bot.botState.clearLiveHandlers(msg.chat.id, customEvent);
        await bot.sendMessageExt(msg.chat.id, "Live handlers are removed from this chat", msg);
    }

    static async getRestrictedUsersHandler(bot: HackerEmbassyBot, msg: Message) {
        const users = UsersRepository.getUsers().filter(u => u.roles.includes("restricted"));
        let userList = "";

        for (const user of users) {
            userList += `${helpers.userLink({ username: user.username, id: user.userid ?? 0 })}\n`;
        }

        await bot.sendLongMessage(msg.chat.id, t("admin.getRestrictedUsers.text") + userList, msg);
    }

    static async getUserHandler(bot: HackerEmbassyBot, msg: Message, query: string) {
        if (!query) return await bot.sendMessageExt(msg.chat.id, "Please provide a username or user id", msg);

        const user = UsersRepository.getUserByName(query) ?? UsersRepository.getByUserId(query);

        if (!user) return await bot.sendMessageExt(msg.chat.id, "User not found", msg);

        return await bot.sendMessageExt(msg.chat.id, JSON.stringify(user), msg);
    }

    static async addUserHandler(bot: HackerEmbassyBot, msg: Message, username: string, rolesString: string) {
        username = username.replace("@", "");
        const roles = rolesString.split("|");

        const success = UsersRepository.addUser(username, roles);
        const text = success
            ? t("admin.addUser.success", { username: helpers.formatUsername(username, bot.context(msg).mode), roles })
            : t("admin.addUser.fail");

        await bot.sendMessageExt(msg.chat.id, text, msg);
    }

    static async updateRolesHandler(bot: HackerEmbassyBot, msg: Message, username: string, rolesString: string) {
        username = username.replace("@", "");
        const roles = rolesString.split("|");

        const success = UsersRepository.updateRoles(username, roles);
        const text = success
            ? t("admin.updateRoles.success", { username: helpers.formatUsername(username, bot.context(msg).mode), roles })
            : t("admin.updateRoles.fail");

        await bot.sendMessageExt(msg.chat.id, text, msg);
    }

    static async updateRolesByIdHandler(bot: HackerEmbassyBot, msg: Message, userid: number, rolesString: string) {
        const roles = rolesString.split("|");

        const success = UsersRepository.updateRolesById(userid, roles);
        const text = success ? t("admin.updateRoles.success", { username: `[${userid}]`, roles }) : t("admin.updateRoles.fail");

        await bot.sendMessageExt(msg.chat.id, text, msg);
    }

    static async removeUserHandler(bot: HackerEmbassyBot, msg: Message, username: string) {
        username = username.replace("@", "");

        const success = UsersRepository.removeUser(username);
        const text = success
            ? t("admin.removeUser.success", { username: helpers.formatUsername(username, bot.context(msg).mode) })
            : t("admin.removeUser.fail");

        await bot.sendMessageExt(msg.chat.id, text, msg);
    }

    static async removeUserByIdHandler(bot: HackerEmbassyBot, msg: Message, userid: number) {
        const success = UsersRepository.removeUserById(userid);
        const text = success ? t("admin.removeUser.success", { username: `[${userid}]` }) : t("admin.removeUser.fail");

        await bot.sendMessageExt(msg.chat.id, text, msg);
    }

    static async setFlagHandler(bot: HackerEmbassyBot, msg: Message, flag: string, value: "true" | "false" | "1" | "0") {
        const flags = bot.botState.flags;
        if (!Object.keys(flags).includes(flag)) {
            await bot.sendMessageExt(msg.chat.id, "Flag not found", msg);
            return;
        }

        flags[flag as keyof StateFlags] = value === "true" || value === "1";
        await bot.botState.persistChanges();

        bot.CustomEmitter.emit(BotCustomEvent.statusLive);

        await bot.sendMessageExt(msg.chat.id, `Flag ${flag} is set to ${value}`, msg);
    }

    static async getFlagsHandler(bot: HackerEmbassyBot, msg: Message) {
        await bot.sendMessageExt(msg.chat.id, JSON.stringify(bot.botState.flags), msg);
    }
}
