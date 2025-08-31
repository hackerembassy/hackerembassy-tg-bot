import fs from "fs";

import { InlineKeyboardButton, KeyboardButton, Message } from "node-telegram-bot-api";
import config from "config";

import { BotConfig } from "@config";

import { User } from "@data/models";
import UsersRepository from "@repositories/users";
import logger, { getLatestLogFilePath } from "@services/common/logger";
import { hasRole } from "@services/domain/user";
import { Admins, CaptureInteger, Members, Route, UserRoles } from "@hackembot/core/decorators";
import { ButtonFlags, InlineButton } from "@hackembot/core/inlineButtons";

import * as TextGenerators from "../text";
import { StateFlags } from "../core/classes/BotState";
import HackerEmbassyBot from "../core/classes/HackerEmbassyBot";
import t from "../core/localization";
import { BotCustomEvent, BotController } from "../core/types";
import * as helpers from "../core/helpers";
import { OptionalParam } from "../core/helpers";

const botConfig = config.get<BotConfig>("bot");

export default class AdminController implements BotController {
    /**
     * Sends a custom message. It can contain text, one image and buttons.
     * Button rows should be in the following format:
     * ```
     * [ {text:text, callback_data:callback_data, url:url, cmd:cmd}, ... ]
     */
    @Route(["custom"], helpers.OptionalParam(/(.*)/ims), match => [match[1]])
    @UserRoles(Members)
    static async customHandler(bot: HackerEmbassyBot, msg: Message, text?: string) {
        const currentChatId = msg.chat.id;

        try {
            const photoId = msg.photo?.[0]?.file_id;

            if (!text)
                return photoId
                    ? bot.sendPhotoExt(currentChatId, photoId, msg)
                    : bot.sendMessageExt(currentChatId, t("admin.custom.help"), msg);

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
                    if (!button.url && button.bot) button.url = `t.me/${bot.name}?start=${button.bot}`;
                });
            });

            const messageText = textLines.join("\n");

            return photoId
                ? await bot.sendPhotoExt(currentChatId, photoId, msg, {
                      reply_markup: { inline_keyboard },
                      caption: messageText,
                  })
                : bot.sendMessageExt(currentChatId, messageText, msg, { reply_markup: { inline_keyboard } });
        } catch (error) {
            const errorMessage = (error as { message?: string }).message;

            return bot.sendMessageExt(currentChatId, `Failed to create a custom message: ${errorMessage}`, msg);
        }
    }

    @Route(["selecttarget", "target"])
    @UserRoles(Admins)
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

    @Route(["getlogs", "logs", "log"])
    @UserRoles(Admins)
    static async getLogHandler(bot: HackerEmbassyBot, msg: Message) {
        const lastLogFilePath = getLatestLogFilePath();

        if (!lastLogFilePath) await bot.sendMessageExt(msg.chat.id, "Log file not found", msg);
        else await bot.sendDocument(msg.chat.id, lastLogFilePath);
    }

    @Route(["getstate", "state"])
    @UserRoles(Admins)
    static async getStateHandler(bot: HackerEmbassyBot, msg: Message) {
        const statepath = bot.botState.statepath;

        if (statepath && fs.existsSync(statepath)) await bot.sendDocument(msg.chat.id, statepath);
    }

    @Route(["cleanstate", "clearstate"])
    @UserRoles(Admins)
    static async cleanStateHandler(bot: HackerEmbassyBot, msg: Message) {
        bot.botState.clearState();
        await bot.sendMessageExt(
            msg.chat.id,
            "Cleared the bot persisted state. Message history and Live handlers are removed",
            msg
        );
    }

    @Route(["stoplive", "cleanlive"])
    @UserRoles(Admins)
    static async stopLiveHandler(bot: HackerEmbassyBot, msg: Message) {
        bot.botState.clearLiveHandlers(msg.chat.id);
        await bot.sendMessageExt(msg.chat.id, "Live handlers are removed from this chat", msg);
    }

    @Route(["getrestrictedusers", "restricted"], null, null)
    @UserRoles(Admins)
    static async getRestrictedUsersHandler(bot: HackerEmbassyBot, msg: Message) {
        const users = UsersRepository.getUsers().filter(u => u.roles?.includes("restricted"));
        let userList = "";

        for (const user of users) {
            userList += `${helpers.userLink(user)}\n`;
        }

        await bot.sendLongMessage(msg.chat.id, t("admin.getRestrictedUsers.text") + userList, msg);
    }

    @Route(["getuser", "user"], OptionalParam(/(\S+?)/), match => [match[1]])
    @UserRoles(Admins)
    static getUserHandler(bot: HackerEmbassyBot, msg: Message, query: string) {
        if (!query) return bot.sendMessageExt(msg.chat.id, "Please provide a username or user id", msg);

        const user = UsersRepository.getUserByName(query.replace("@", "")) ?? UsersRepository.getUserByUserId(query);

        if (!user) return bot.sendMessageExt(msg.chat.id, "User not found", msg);

        return bot.sendMessageExt(msg.chat.id, JSON.stringify(user), msg);
    }

    @Route(["setuser"], OptionalParam(/(.*)/ims), match => [match[1]])
    @UserRoles(Admins)
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

    @Route(["updateroles"], /of (\S+?) to (\S+)/, match => [match[1], match[2]])
    @Route(["restrict"], /(\S+?)/, match => [match[1], "restricted"])
    @Route(["unblock"], /(\S+?)/, match => [match[1], "default"])
    @UserRoles(Admins)
    static updateRolesHandler(bot: HackerEmbassyBot, msg: Message, username: string, rolesString: string) {
        const roles = rolesString.split("|");
        const user = UsersRepository.getUserByName(username.replace("@", ""));

        if (!user) return bot.sendMessageExt(msg.chat.id, t("general.errors.nouser"), msg);

        const success = UsersRepository.updateRoles(user.userid, roles);
        const text = success
            ? t("admin.updateRoles.success", { username: helpers.formatUsername(username), roles })
            : t("admin.updateRoles.fail");

        return bot.sendMessageExt(msg.chat.id, text, msg);
    }

    @Route(["restrictbyid"], /(\d+?)/, match => [match[1], "restricted"])
    @Route(["unblockbyid"], /(\d+?)/, match => [match[1], "default"])
    @UserRoles(Admins)
    static async updateRolesByIdHandler(bot: HackerEmbassyBot, msg: Message, userid: number, rolesString: string) {
        const roles = rolesString.split("|");

        const success = UsersRepository.updateRoles(userid, roles);
        const text = success ? t("admin.updateRoles.success", { username: `[${userid}]`, roles }) : t("admin.updateRoles.fail");

        await bot.sendMessageExt(msg.chat.id, text, msg);
    }

    @Route(["removeuser"], /(\S+)/, match => [match[1]])
    @UserRoles(Admins)
    static async removeUserHandler(bot: HackerEmbassyBot, msg: Message, username: string) {
        username = username.replace("@", "");

        const success = UsersRepository.removeUserByUsername(username);
        const text = success
            ? t("admin.removeUser.success", { username: helpers.formatUsername(username) })
            : t("admin.removeUser.fail");

        await bot.sendMessageExt(msg.chat.id, text, msg);
    }

    @Route(["removeuserbyid"], /(\d+)/, match => [match[1]])
    @UserRoles(Admins)
    static async removeUserByIdHandler(bot: HackerEmbassyBot, msg: Message, userid: number) {
        const success = UsersRepository.removeUserById(userid);
        const text = success ? t("admin.removeUser.success", { username: `[${userid}]` }) : t("admin.removeUser.fail");

        await bot.sendMessageExt(msg.chat.id, text, msg);
    }

    @Route(["setflag", "setf", "set"], /(\S+?) (true|false|1|0)/, match => [match[1], match[2]])
    @UserRoles(Admins)
    static async setFlagHandler(bot: HackerEmbassyBot, msg: Message, flag: string, value: "true" | "false" | "1" | "0") {
        const flags = bot.botState.flags;
        if (!Object.keys(flags).includes(flag)) {
            await bot.sendMessageExt(msg.chat.id, "Flag not found", msg);
            return;
        }

        flags[flag as keyof StateFlags] = value === "true" || value === "1";
        await bot.botState.persistChanges();

        bot.customEmitter.emit(BotCustomEvent.statusLive);

        await bot.sendMessageExt(msg.chat.id, `Flag ${flag} is set to ${value}`, msg);
    }

    @Route(["getflags", "getf"])
    @UserRoles(Admins)
    static async getFlagsHandler(bot: HackerEmbassyBot, msg: Message) {
        await bot.sendMessageExt(msg.chat.id, JSON.stringify(bot.botState.flags), msg);
    }

    @Route(["autoremove", "silent", "stopsrach", "стопсрач"], OptionalParam(/(\S+)/), match => [match[1]])
    @UserRoles(Admins)
    static async autoRemoveHandler(bot: HackerEmbassyBot, msg: Message, chat: string | undefined) {
        if (!chat) return await bot.sendMessageExt(msg.chat.id, "Please provide a chat id, clear, list or here command", msg);

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
            case "here":
                bot.autoRemoveChats.push(msg.chat.id);
                break;
            default:
                bot.autoRemoveChats.push(Number(chat));
        }

        return await bot.sendMessageExt(msg.chat.id, `Chat ${chat} is added to the silent list`, msg);
    }

    @Route(["ban", "block"], OptionalParam(/(\S+)/), match => [match[1]])
    @UserRoles(Members)
    static async banHandler(bot: HackerEmbassyBot, msg: Message, target?: number | string) {
        const removeBanMessageTimeout = 3000;
        const isPrivate = bot.context(msg).isPrivate();

        try {
            const reply = msg.reply_to_message;
            const effectiveTarget = target ?? (reply?.from && !reply.from.is_bot ? reply.from.id : undefined);

            if (!effectiveTarget) return;

            const user =
                typeof effectiveTarget === "number"
                    ? UsersRepository.getUserByUserId(effectiveTarget)
                    : (UsersRepository.getUserByUserId(Number(effectiveTarget)) ??
                      UsersRepository.getUserByName(effectiveTarget.replace("@", "")));

            const canBeBanned = user && !hasRole(user, "admin", "accountant", "member");

            if (!canBeBanned) return bot.sendMessageExt(msg.chat.id, "🙅 User cannot be banned", msg);

            // Just ban from the bot if the chat is private
            const wasBanned =
                (!isPrivate || (await bot.banChatMember(msg.chat.id, user.userid))) &&
                UsersRepository.updateRoles(user.userid, ["banned"]);

            const banMessage = await bot.sendMessageExt(
                msg.chat.id,
                wasBanned ? `🔨 User is banned ${effectiveTarget}` : "⚠️ Failed to ban the user",
                msg
            );

            if (!banMessage) throw new Error("Failed to send ban message");

            if (isPrivate) return;

            // Remove ban messages from public chats
            const messagesToDelete = [banMessage.message_id];
            const isButtonResponse = bot.context(msg).isButtonResponse;

            if (wasBanned) {
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

            if (isPrivate) return;

            return setTimeout(
                () => failedMessage && bot.deleteMessage(failedMessage.chat.id, failedMessage.message_id).catch(logger.error),
                removeBanMessageTimeout
            );
        }
    }

    @Route(["linkchat"], CaptureInteger, match => [match[1]])
    @UserRoles(Admins)
    static linkChatHandler(bot: HackerEmbassyBot, msg: Message, target: string) {
        if (!bot.context(msg).isPrivate()) return;

        bot.chatBridge.link(Number(target), msg.chat.id);

        bot.sendMessageExt(msg.chat.id, `Chat ${target} is linked to admin ${msg.from?.username}`, msg);
    }

    @Route(["unlinkchat"])
    @UserRoles(Admins)
    static unlinkChatHandler(bot: HackerEmbassyBot, msg: Message) {
        if (!bot.context(msg).isPrivate()) return;

        bot.chatBridge.unlink(msg.chat.id);

        bot.sendMessageExt(msg.chat.id, `Chats are unlinked from admin ${msg.from?.username}`, msg);
    }

    @Route(["getlinkedchat"])
    @UserRoles(Admins)
    static getLinkedChatHandler(bot: HackerEmbassyBot, msg: Message) {
        if (!bot.context(msg).isPrivate()) return;

        const linkedChats = bot.chatBridge.getLinkedChat(msg.chat.id);

        if (linkedChats) {
            bot.sendMessageExt(msg.chat.id, `Linked chat: ${linkedChats}`, msg);
        } else {
            bot.sendMessageExt(msg.chat.id, "No linked chats", msg);
        }
    }

    @Route(["copy"], OptionalParam(/(\S+?)/), match => [match[1]])
    @UserRoles(Members)
    static async copyMessageHandler(bot: HackerEmbassyBot, msg: Message, target: string) {
        const chatsList = TextGenerators.getCopyableList([...Object.keys(botConfig.chats), "me"], ", ");
        if (!msg.reply_to_message || !target) return bot.sendMessageExt(msg.chat.id, t("admin.copy.help", { chatsList }), msg);

        const chatId =
            botConfig.chats[target as keyof typeof botConfig.chats] || (target === "me" ? msg.from?.id : Number(target));
        if (!chatId || isNaN(chatId)) return bot.sendMessageExt(msg.chat.id, t("admin.copy.nochat"), msg);

        await bot.copyMessage(chatId, msg.chat.id, msg.reply_to_message.message_id, {
            reply_markup: msg.reply_to_message.reply_markup,
            caption: msg.reply_to_message.caption,
        });
        return bot.sendMessageExt(msg.chat.id, t("admin.copy.success", { target }), msg);
    }

    @Route(["save"], OptionalParam(/(\S+?)/), match => [match[1]])
    static saveMessageHandler(bot: HackerEmbassyBot, msg: Message, messageId?: number) {
        const replyMessage = msg.reply_to_message;
        const targetChatId = msg.from?.id;
        const messageIdToCopy = replyMessage?.message_id ?? messageId;

        if (!messageIdToCopy || !targetChatId) return bot.sendMessageExt(msg.chat.id, t("admin.save.help"), msg);

        if (replyMessage?.message_id) {
            bot.sendMessageExt(msg.chat.id, t("admin.save.success"), msg, {
                reply_markup: {
                    inline_keyboard: [
                        [InlineButton(t("admin.save.button"), `save`, ButtonFlags.Simple, { params: replyMessage.message_id })],
                    ],
                },
            });
        }

        logger.info(
            `User ${msg.from?.username} (${targetChatId}) is saving message ${messageIdToCopy} from chat ${msg.chat.title} (${msg.chat.id})`
        );

        return bot.copyMessage(targetChatId, msg.chat.id, messageIdToCopy, {
            caption: replyMessage?.caption,
        });
    }

    @Route(["die", "kill"])
    @UserRoles(Members)
    static async dieHandler(bot: HackerEmbassyBot, msg: Message) {
        await bot.sendMessageExt(msg.chat.id, "☠️ Oh no, im ded (docker pls save me)", msg);
        logger.info(`Bot is shutting down by admin command from ${msg.from?.username} (${msg.from?.id})`);
        setTimeout(async () => {
            await bot.stopPolling();
            process.exit(0);
        }, 5000);
    }
}
