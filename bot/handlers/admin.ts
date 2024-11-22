import fs from "fs";

import { InlineKeyboardButton, KeyboardButton, Message } from "node-telegram-bot-api";
import config from "config";

import UsersRepository from "@repositories/users";
import logger, { getLatestLogFilePath } from "@services/logger";
import { BotConfig } from "@config";

import { User } from "@data/models";

import { StateFlags } from "../core/BotState";
import HackerEmbassyBot from "../core/HackerEmbassyBot";
import t from "../core/localization";
import { BotCustomEvent, BotHandlers } from "../core/types";
import * as helpers from "../core/helpers";

const botConfig = config.get<BotConfig>("bot");

export default class AdminHandlers implements BotHandlers {
    /**
     * Sends a custom message. It can contain text, one image and buttons.
     * Button rows should be in the following format:
     * ```
     * [ {text:text, callback_data:callback_data, url:url, cmd:cmd}, ... ]
     */
    static async customHandler(bot: HackerEmbassyBot, msg: Message, text?: string, isTest: boolean = false) {
        const targetChatId = isTest ? msg.chat.id : bot.forwardTarget;
        const selfChatId = msg.chat.id;

        try {
            const photoId = msg.photo?.[0]?.file_id;
            const example = `#\`/${
                isTest ? "customt" : "custom"
            } Some text\n\n[{"text":"link","url":"https://hackem.cc"}]\n\n[{"text":"public cmd","cmd":"join"},{"text":"private cmd","bot":"join"}]#\``;

            if (!text) {
                if (photoId) {
                    await bot.sendPhotoExt(targetChatId, photoId, msg);
                    if (!isTest) await bot.sendMessageExt(selfChatId, `Photo is forwarded to ${targetChatId}`, msg);
                } else {
                    await bot.sendMessageExt(selfChatId, `Example:\n${example}`, msg);
                }
                return;
            }

            const lines = text.split("\n").map(l => l.trim());
            const textLines = lines.filter(l => !l.startsWith("[") && !l.endsWith("]"));
            const buttonLines = lines.filter(l => l.startsWith("[") && l.endsWith("]"));

            const inline_keyboard = buttonLines.map(
                line =>
                    JSON.parse(line, (key, value) => {
                        if (key === "callback_data") {
                            return JSON.stringify(value);
                        }
                        return value;
                    }) as (InlineKeyboardButton & { cmd?: string; bot?: string })[]
            );
            // Allow simplified button definition
            inline_keyboard.forEach(row => {
                row.forEach(button => {
                    if (!button.callback_data && button.cmd) button.callback_data = JSON.stringify({ cmd: button.cmd });
                    if (!button.url && button.bot) button.url = `t.me/${bot.Name}?start=${button.bot}`;
                });
            });

            const messageText = textLines.join("\n");

            photoId
                ? await bot.sendPhotoExt(targetChatId, photoId, msg, {
                      reply_markup: { inline_keyboard },
                      caption: messageText,
                  })
                : await bot.sendMessageExt(targetChatId, messageText, msg, { reply_markup: { inline_keyboard } });

            bot.context(msg).mode.pin = false;

            if (!isTest) await bot.sendMessageExt(selfChatId, `Message is forwarded to ${targetChatId}`, msg);
        } catch (error) {
            const errorMessage = (error as { message?: string }).message;

            bot.context(msg).mode.pin = false;
            await bot.sendMessageExt(selfChatId, `Failed to forward the message: ${errorMessage}`, msg);
        }
    }

    static async selectForwardTargetHandler(bot: HackerEmbassyBot, msg: Message) {
        const keyboardButton: KeyboardButton = {
            text: "Select target chat",
            request_chat: {
                request_id: 1,
                bot_is_member: true,
                chat_is_channel: false,
            },
        };

        await bot.sendMessageExt(msg.chat.id, "Changing forward target", msg, {
            reply_markup: { keyboard: [[keyboardButton]], one_time_keyboard: true },
        });
    }

    static async getLogHandler(bot: HackerEmbassyBot, msg: Message) {
        const lastLogFilePath = getLatestLogFilePath();

        if (!lastLogFilePath) await bot.sendMessageExt(msg.chat.id, "Log file not found", msg);
        else await bot.sendDocument(msg.chat.id, lastLogFilePath);
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
    static readonly eventCommandMap = {
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
        const users = UsersRepository.getUsers().filter(u => u.roles?.includes("restricted"));
        let userList = "";

        for (const user of users) {
            userList += `${helpers.userLink(user)}\n`;
        }

        await bot.sendLongMessage(msg.chat.id, t("admin.getRestrictedUsers.text") + userList, msg);
    }

    static getUserHandler(bot: HackerEmbassyBot, msg: Message, query: string) {
        if (!query) return bot.sendMessageExt(msg.chat.id, "Please provide a username or user id", msg);

        const user = UsersRepository.getUserByName(query.replace("@", "")) ?? UsersRepository.getUserByUserId(query);

        if (!user) return bot.sendMessageExt(msg.chat.id, "User not found", msg);

        return bot.sendMessageExt(msg.chat.id, JSON.stringify(user), msg);
    }

    static setUserHandler(bot: HackerEmbassyBot, msg: Message, json: string) {
        if (!json) return bot.sendMessageExt(msg.chat.id, "Please provide a serialized user", msg);

        try {
            const updatedUser = JSON.parse(json) as User;
            UsersRepository.updateUser(updatedUser.userid, updatedUser);

            return bot.sendMessageExt(msg.chat.id, `User ${updatedUser.userid} was updated`, msg);
        } catch (error) {
            logger.error(error);
            return bot.sendMessageExt(msg.chat.id, `User was not updated. Error ${(error as Error).message}`, msg);
        }
    }

    static updateRolesHandler(bot: HackerEmbassyBot, msg: Message, username: string, rolesString: string) {
        const roles = rolesString.split("|");
        const user = UsersRepository.getUserByName(username.replace("@", ""));

        if (!user) return bot.sendMessageExt(msg.chat.id, t("general.nouser"), msg);

        const success = UsersRepository.updateRoles(user.userid, roles);
        const text = success
            ? t("admin.updateRoles.success", { username: helpers.formatUsername(username), roles })
            : t("admin.updateRoles.fail");

        return bot.sendMessageExt(msg.chat.id, text, msg);
    }

    static async updateRolesByIdHandler(bot: HackerEmbassyBot, msg: Message, userid: number, rolesString: string) {
        const roles = rolesString.split("|");

        const success = UsersRepository.updateRoles(userid, roles);
        const text = success ? t("admin.updateRoles.success", { username: `[${userid}]`, roles }) : t("admin.updateRoles.fail");

        await bot.sendMessageExt(msg.chat.id, text, msg);
    }

    static async removeUserHandler(bot: HackerEmbassyBot, msg: Message, username: string) {
        username = username.replace("@", "");

        const success = UsersRepository.removeUserByUsername(username);
        const text = success
            ? t("admin.removeUser.success", { username: helpers.formatUsername(username) })
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

    static async autoRemoveHandler(bot: HackerEmbassyBot, msg: Message, chat: string | undefined) {
        if (!chat) return await bot.sendMessageExt(msg.chat.id, "Please provide a chat id, clear or list command", msg);

        switch (chat) {
            case "clear":
                bot.autoRemoveChats = [];
                return await bot.sendMessageExt(msg.chat.id, "Banned chats are cleared", msg);
            case "list":
                return await bot.sendMessageExt(msg.chat.id, `Banned chats: ${bot.autoRemoveChats.join(", ")}`, msg);
            case "main":
                bot.autoRemoveChats.push(botConfig.chats.main);
                break;
            case "offtopic":
                bot.autoRemoveChats.push(botConfig.chats.offtopic);
                break;
            case "horny":
                bot.autoRemoveChats.push(botConfig.chats.horny);
                break;
            default:
                bot.autoRemoveChats.push(chat);
        }

        return await bot.sendMessageExt(msg.chat.id, `Chat ${chat} is added to the silent list`, msg);
    }

    static async banHandler(bot: HackerEmbassyBot, msg: Message, target?: number | string) {
        const removeBanMessageTimeout = 3000;

        try {
            const reply = msg.reply_to_message;
            const effectiveTarget = target ?? (reply?.from && !reply.from.is_bot ? reply.from.id : undefined);

            if (!effectiveTarget) return;

            const user =
                typeof effectiveTarget === "number"
                    ? UsersRepository.getUserByUserId(effectiveTarget)
                    : (UsersRepository.getUserByUserId(Number(effectiveTarget)) ??
                      UsersRepository.getUserByName(effectiveTarget.replace("@", "")));

            const wasBanned =
                user &&
                !helpers.hasRole(user, "admin", "accountant", "member") &&
                (await bot.banChatMember(msg.chat.id, user.userid));

            const banMessage = await bot.sendMessageExt(
                msg.chat.id,
                wasBanned ? `🔨 User is banned ${effectiveTarget}` : "🙅 User cannot be banned",
                msg
            );

            if (!banMessage) throw new Error("Failed to send ban message");

            const messagesToDelete = [banMessage.message_id];
            const isButtonResponse = bot.context(msg).isButtonResponse;

            if (wasBanned) {
                UsersRepository.updateRoles(user.userid, ["banned"]);

                if (reply) messagesToDelete.push(reply.message_id);
                if (isButtonResponse) messagesToDelete.push(msg.message_id);
            } else if (!isButtonResponse) {
                messagesToDelete.push(msg.message_id);
            }

            return setTimeout(
                () => bot.deleteMessages(banMessage.chat.id, messagesToDelete).catch(logger.error),
                removeBanMessageTimeout
            );
        } catch (error) {
            logger.error(error);

            const failedMessage = await bot.sendMessageExt(msg.chat.id, "🤡 /banFailed to ban user", msg);

            return setTimeout(
                () => failedMessage && bot.deleteMessage(failedMessage.chat.id, failedMessage.message_id).catch(logger.error),
                removeBanMessageTimeout
            );
        }
    }
}
