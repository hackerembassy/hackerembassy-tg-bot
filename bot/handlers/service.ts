import config from "config";
import TelegramBot, { ChatMemberUpdated, Message } from "node-telegram-bot-api";

import { BotConfig } from "../../config/schema";
import UsersRepository from "../../repositories/usersRepository";
import t from "../../services/localization";
import logger from "../../services/logger";
import { OpenAI } from "../../services/neural";
import { sleep } from "../../utils/common";
import HackerEmbassyBot, { FULL_PERMISSIONS, MAX_MESSAGE_LENGTH, RESTRICTED_PERMISSIONS } from "../core/HackerEmbassyBot";
import RateLimiter from "../core/RateLimiter";
import { BotHandlers, ITelegramUser, MessageHistoryEntry } from "../core/types";
import { InlineButton, userLink } from "../helpers";
import { setMenu } from "../init/menu";
import EmbassyHandlers from "./embassy";
import StatusHandlers from "./status";

const botConfig = config.get<BotConfig>("bot");

type CallbackData = {
    fs?: Flags;
    vId?: number;
    cmd?: string;

    params?: any;
};

export enum Flags {
    Simple = 0,
    Editing = 1 << 0, // 01
    Silent = 1 << 1, // 10
}

export default class ServiceHandlers implements BotHandlers {
    static async clearHandler(bot: HackerEmbassyBot, msg: Message, count: string) {
        const inputCount = Number(count);
        const countToClear = inputCount > 0 ? inputCount : 1;
        const orderOfLastMessage = msg.reply_to_message?.message_id
            ? bot.messageHistory.orderOf(msg.chat.id, msg.reply_to_message.message_id)
            : 0;

        if (orderOfLastMessage === undefined || orderOfLastMessage === null || orderOfLastMessage === -1) return;

        let messagesRemained = countToClear;
        while (messagesRemained > 0) {
            const message = bot.messageHistory.pop(msg.chat.id, orderOfLastMessage);
            if (!message) return;

            const success = await bot.deleteMessage(msg.chat.id, message.messageId).catch(() => false);
            if (success) messagesRemained--;
        }
    }

    static async combineHandler(bot: HackerEmbassyBot, msg: Message, count: string) {
        const inputCount = Number(count);
        const countToCombine = inputCount > 2 ? inputCount : 2;

        const orderOfLastMessageToEdit = msg.reply_to_message?.message_id
            ? bot.messageHistory.orderOf(msg.chat.id, msg.reply_to_message.message_id)
            : 0;

        if (orderOfLastMessageToEdit === undefined || orderOfLastMessageToEdit === null || orderOfLastMessageToEdit === -1)
            return;

        let lastMessageToEdit: Nullable<MessageHistoryEntry>;
        let foundLast = false;

        do {
            lastMessageToEdit = bot.messageHistory.pop(msg.chat.id, orderOfLastMessageToEdit);
            if (!lastMessageToEdit) return;
            foundLast = await bot
                .editMessageTextExt("combining...", msg, {
                    chat_id: msg.chat.id,
                    message_id: lastMessageToEdit.messageId,
                })
                .then(() => true)
                .catch(() => false);
        } while (!foundLast);

        const preparedMessages = [];
        preparedMessages.push(lastMessageToEdit);

        let messagesRemained = countToCombine - 1;

        while (messagesRemained > 0) {
            const message = bot.messageHistory.pop(msg.chat.id, orderOfLastMessageToEdit);
            if (!message) break;

            const success = await bot.deleteMessage(msg.chat.id, message.messageId).catch(() => false);
            // TODO combining images into one message
            if (success) {
                preparedMessages.push(message);
                messagesRemained--;
            }
        }

        preparedMessages.reverse();
        let combinedMessageText = preparedMessages
            .map(m => {
                const datePrefix = `[${new Date(m.datetime).toLocaleString("RU-ru").substring(12, 17)}]: `;
                return `${m.text?.match(/^\[\d{2}:\d{2}\]/) ? "" : datePrefix}${m.text ?? "photo"}`;
            })
            .join("\n");

        if (combinedMessageText.length > MAX_MESSAGE_LENGTH) combinedMessageText = "message is too big";

        bot.messageHistory.push(msg.chat.id, lastMessageToEdit.messageId, combinedMessageText, orderOfLastMessageToEdit);

        if (combinedMessageText !== lastMessageToEdit.text) {
            await bot.editMessageTextExt(combinedMessageText, msg, {
                chat_id: msg.chat.id,
                message_id: lastMessageToEdit.messageId,
            });
        }
    }

    static async chatidHandler(bot: HackerEmbassyBot, msg: Message) {
        await bot.sendMessageExt(msg.chat.id, `chatId: ${msg.chat.id}, topicId: ${msg.message_thread_id}`, msg);
    }

    static async residentMenuHandler(bot: HackerEmbassyBot, msg: Message) {
        const usernameOrFirstname = msg.from?.username ?? msg.from?.first_name;
        if (!usernameOrFirstname) return;

        UsersRepository.setUserid(usernameOrFirstname, msg.from?.id ?? null);

        await setMenu(bot);

        bot.sendMessageExt(
            msg.chat.id,
            `Resident menu is enabled for ${usernameOrFirstname}[userid:${msg.from?.id}] in the private chat`,
            msg
        );
    }

    static async superstatusHandler(bot: HackerEmbassyBot, msg: Message) {
        await StatusHandlers.statusHandler(bot, msg);
        await EmbassyHandlers.allCamsHandler(bot, msg);
    }

    static async callbackHandler(bot: HackerEmbassyBot, callbackQuery: TelegramBot.CallbackQuery) {
        const msg = callbackQuery.message;

        try {
            await bot.answerCallbackQuery(callbackQuery.id);

            if (!msg || !msg.from?.id) throw Error("Message with User id is not found");

            bot.context(msg).messageThreadId = msg.message_thread_id;

            await RateLimiter.throttled(ServiceHandlers.routeQuery, msg.from.id)(bot, callbackQuery, msg);
        } catch (error) {
            logger.error(error);
        } finally {
            msg && bot.context(msg).clear();
        }
    }

    static async routeQuery(bot: HackerEmbassyBot, callbackQuery: TelegramBot.CallbackQuery, msg: Message) {
        const data = callbackQuery.data ? (JSON.parse(callbackQuery.data) as CallbackData) : undefined;
        if (!data) throw Error("Missing calback query data");

        msg.from = callbackQuery.from;

        if (data.vId) {
            if (callbackQuery.from.id !== data.vId) return;

            return ServiceHandlers.handleUserVerification(bot, data.vId, msg);
        }

        const command = data.cmd;
        if (!command) throw Error("Missing calback command");

        const route = bot.routeMap.get(command);
        if (!route) throw Error(`Calback route for ${command} does not exist`);

        const handler = route.handler;

        if (!bot.canUserCall(msg.from.username, command)) return;

        bot.context(msg).isButtonResponse = true;

        if (data.fs !== undefined) {
            if (data.fs & Flags.Silent) bot.context(msg).mode.silent = true;
            if (data.fs & Flags.Editing) bot.context(msg).isEditing = true;
        }

        const params: [HackerEmbassyBot, TelegramBot.Message, ...any] = [bot, msg];

        if (data.params !== undefined) {
            params.push(data.params);
        }

        await handler.apply(bot, params);
    }

    private static async handleUserVerification(bot: HackerEmbassyBot, vId: number, msg: TelegramBot.Message) {
        const tgUser = (await bot.getChat(vId)) as ITelegramUser;

        if (ServiceHandlers.verifyAndAddUser(tgUser)) {
            try {
                botConfig.moderatedChats.forEach(chatId =>
                    bot.restrictChatMember(chatId, tgUser.id as number, FULL_PERMISSIONS).catch(error => logger.error(error))
                );

                await bot.deleteMessage(msg.chat.id, msg.message_id);
                await ServiceHandlers.welcomeHandler(bot, msg.chat, tgUser);
            } catch (error) {
                logger.error(error);
            }
        }
    }

    static async conditionerCallback(bot: HackerEmbassyBot, msg: Message, callback: () => Promise<void>) {
        bot.context(msg).mode.silent = true;
        bot.context(msg).isEditing = true;

        await callback();
        await sleep(5000);
        await EmbassyHandlers.conditionerHandler(bot, msg);
    }

    static async removeButtons(bot: HackerEmbassyBot, msg: Message) {
        await bot.editMessageReplyMarkup(
            {
                inline_keyboard: [],
            },
            {
                message_id: msg.message_id,
                chat_id: msg.chat.id,
            }
        );
    }

    static async newMemberHandler(bot: HackerEmbassyBot, memberUpdated: ChatMemberUpdated) {
        if (!(memberUpdated.old_chat_member.status === "left" && memberUpdated.new_chat_member.status === "member")) {
            return;
        }

        const user = memberUpdated.new_chat_member.user;
        const chat = memberUpdated.chat;

        if (!botConfig.moderatedChats.includes(chat.id)) {
            return await ServiceHandlers.welcomeHandler(bot, chat, user);
        }

        const currentUser = UsersRepository.getByUserId(user.id);

        if (currentUser === null) {
            UsersRepository.addUser(user.username, ["restricted"], user.id);
            bot.restrictChatMember(chat.id, user.id, RESTRICTED_PERMISSIONS);
            logger.info(`New user [${user.id}](${user.username}) joined the chat [${chat.id}](${chat.title}) as restricted`);
        } else if (!currentUser.roles.includes("restricted")) {
            logger.info(
                `Known user [${currentUser.userid}](${currentUser.username}) joined the chat [${chat.id}](${chat.title})`
            );
            return await ServiceHandlers.welcomeHandler(bot, chat, user);
        } else {
            bot.restrictChatMember(chat.id, user.id, RESTRICTED_PERMISSIONS);
            logger.info(`Restricted user [${user.id}](${user.username}) joined the chat [${chat.id}](${chat.title}) again`);
        }

        const welcomeText = t("service.welcome.confirm", { newMember: userLink(user) });
        const inline_keyboard = [[InlineButton(t("service.welcome.captcha"), undefined, Flags.Simple, { vId: user.id })]];

        await bot.sendMessageExt(chat.id, welcomeText, null, {
            reply_markup: { inline_keyboard },
        });
    }

    static verifyAndAddUser(tgUser: ITelegramUser) {
        const user = UsersRepository.getByUserId(tgUser.id);

        if (!user) throw new Error(`Restricted user ${tgUser.username} with id ${tgUser.id} should exist`);

        if (!user.roles.includes("restricted")) {
            logger.info(`User [${tgUser.id}](${tgUser.username}) was already verified`);
            return true;
        }

        logger.info(`User [${tgUser.id}](${tgUser.username}) passed the verification`);

        return UsersRepository.updateUser({ ...user, roles: "default" });
    }

    static async welcomeHandler(bot: HackerEmbassyBot, chat: TelegramBot.Chat, tgUser: ITelegramUser) {
        const newMember = userLink(tgUser);
        const botName = bot.Name;

        let welcomeText: string;

        switch (chat.id) {
            case botConfig.chats.offtopic:
                welcomeText = t("service.welcome.offtopic", { botName, newMember });
                break;
            case botConfig.chats.key:
                welcomeText = t("service.welcome.key", { botName, newMember });
                break;
            case botConfig.chats.horny:
                welcomeText = t("service.welcome.horny", { botName, newMember });
                break;
            case botConfig.chats.main:
            default:
                welcomeText = t("service.welcome.main", { botName, newMember });
        }

        await bot.sendMessageExt(chat.id, welcomeText, null);
    }

    static async askHandler(bot: HackerEmbassyBot, msg: Message, prompt: string) {
        const loading = setInterval(() => bot.sendChatAction(msg.chat.id, "typing", msg), 5000);

        try {
            bot.sendChatAction(msg.chat.id, "typing", msg);

            const apiKey = process.env["OPENAIAPIKEY"];
            const allowedChats = [
                botConfig.chats.main,
                botConfig.chats.horny,
                botConfig.chats.offtopic,
                botConfig.chats.key,
                botConfig.chats.test,
            ];

            if (!apiKey) {
                await bot.sendMessageExt(msg.chat.id, t("service.openai.notset"), msg);
                return;
            }

            if (!allowedChats.includes(msg.chat.id)) {
                await bot.sendMessageExt(msg.chat.id, t("service.openai.chatnotallowed"), msg);
                return;
            }

            if (!prompt) {
                await bot.sendMessageExt(msg.chat.id, t("service.openai.help"), msg);
                return;
            }

            const loading = setTimeout(() => bot.sendChatAction(msg.chat.id, "typing", msg), 5000);
            const openAI = new OpenAI(apiKey);
            const response = await openAI.askChat(prompt);

            clearInterval(loading);

            await bot.sendMessageExt(msg.chat.id, response.content, msg);
        } catch (error) {
            await bot.sendMessageExt(msg.chat.id, t("service.openai.error"), msg);
            logger.error(error);
        } finally {
            clearInterval(loading);
        }
    }
}
