import config from "config";
import TelegramBot, { ChatMemberUpdated, Message } from "node-telegram-bot-api";

import { BotConfig } from "../../config/schema";
import UsersRepository from "../../repositories/usersRepository";
import t, { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from "../../services/localization";
import logger from "../../services/logger";
import { OpenAI } from "../../services/neural";
import { sleep } from "../../utils/common";
import HackerEmbassyBot, {
    asyncMessageLocalStorage,
    FULL_PERMISSIONS,
    MAX_MESSAGE_LENGTH_WITH_TAGS,
    RESTRICTED_PERMISSIONS,
} from "../core/HackerEmbassyBot";
import { ButtonFlags, InlineButton } from "../core/InlineButtons";
import { UserRateLimiter } from "../core/RateLimit";
import { BotHandlers, ITelegramUser, MessageHistoryEntry } from "../core/types";
import { userLink } from "../helpers";
import { setMenu } from "../init/menu";
import EmbassyHandlers from "./embassy";
import StatusHandlers from "./status";

const botConfig = config.get<BotConfig>("bot");

type CallbackData = {
    fs?: ButtonFlags;
    vId?: number;
    cmd?: string;

    params?: any;
};

const WelcomeMessageMap: {
    [x: number]: string | undefined;
} = {
    [botConfig.chats.main]: "service.welcome.main",
    [botConfig.chats.offtopic]: "service.welcome.offtopic",
    [botConfig.chats.key]: "service.welcome.key",
    [botConfig.chats.horny]: "service.welcome.horny",
};

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

        // find a suitable message to edit (because images are not supported yet)
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

        let messagesRemained = countToCombine - 1;
        let combinedMessageLength = 0;

        // TODO allow combining images into one message
        while (messagesRemained > 0) {
            const message = bot.messageHistory.get(msg.chat.id, orderOfLastMessageToEdit);
            const messageLength = message?.text?.length ?? 0;

            if (!message) break;
            if (combinedMessageLength + messageLength > MAX_MESSAGE_LENGTH_WITH_TAGS) break;

            bot.messageHistory.pop(msg.chat.id, orderOfLastMessageToEdit);
            combinedMessageLength += messageLength;
            preparedMessages.push(message);
            messagesRemained--;
        }

        try {
            await bot.deleteMessages(
                msg.chat.id,
                preparedMessages.map(m => m.messageId)
            );
        } catch (error) {
            logger.error(error);
        }

        preparedMessages.unshift(lastMessageToEdit);
        preparedMessages.reverse();

        const combinedMessageText = preparedMessages
            .map(m => {
                const datePrefix = `[${new Date(m.datetime).toLocaleString("RU-ru").substring(12, 17)}]: `;
                return `${m.text?.match(/^\[\d{2}:\d{2}\]/) ? "" : datePrefix}${m.text ?? "photo"}`;
            })
            .join("\n");

        bot.messageHistory.push(msg.chat.id, lastMessageToEdit.messageId, combinedMessageText, orderOfLastMessageToEdit);

        if (combinedMessageText !== lastMessageToEdit.text) {
            await bot.editMessageTextExt(combinedMessageText, msg, {
                chat_id: msg.chat.id,
                message_id: lastMessageToEdit.messageId,
            });
        }
    }

    static async chatidHandler(bot: HackerEmbassyBot, msg: Message) {
        if (msg.chat.type === "private") {
            await bot.sendMessageExt(msg.chat.id, `chatId: ${msg.chat.id}`, msg);
        } else if (msg.from && UsersRepository.getByUserId(msg.from.id)?.roles.includes("member")) {
            await bot.sendMessageExt(msg.chat.id, `chatId: ${msg.chat.id}, topicId: ${msg.message_thread_id}`, msg);
        } else {
            bot.sendRestrictedMessage(msg);
        }
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

            await UserRateLimiter.throttled(ServiceHandlers.routeQuery, msg.from.id)(bot, callbackQuery, msg);
        } catch (error) {
            logger.error(error);
        } finally {
            msg && bot.context(msg).clear();
        }
    }

    static async routeQuery(bot: HackerEmbassyBot, callbackQuery: TelegramBot.CallbackQuery, msg: Message) {
        const data = callbackQuery.data ? (JSON.parse(callbackQuery.data) as CallbackData) : undefined;
        const context = bot.context(msg);
        context.isButtonResponse = true;

        if (!data) throw Error("Missing calback query data");

        msg.from = callbackQuery.from;

        if (data.vId) {
            if (callbackQuery.from.id !== data.vId) return;

            asyncMessageLocalStorage.run(context, () =>
                ServiceHandlers.handleUserVerification(bot, data.vId as number, data.params as string, msg)
            );

            return;
        }

        const command = data.cmd;
        if (!command) throw Error("Missing calback command");

        const route = bot.routeMap.get(command);
        if (!route) throw Error(`Calback route for ${command} does not exist`);

        const handler = route.handler;
        const user = UsersRepository.getByUserId(msg.from.id);

        if (!bot.canUserCall(user, command)) return;

        context.mode.secret = bot.isSecretModeAllowed(msg, context);
        context.language = user?.language ?? DEFAULT_LANGUAGE;

        if (data.fs !== undefined) {
            if (data.fs & ButtonFlags.Silent) context.mode.silent = true;
            if (data.fs & ButtonFlags.Editing) context.isEditing = true;
        }

        const params: [HackerEmbassyBot, TelegramBot.Message, ...any] = [bot, msg];

        if (data.params !== undefined) {
            params.push(data.params);
        }

        await asyncMessageLocalStorage.run(context, () => handler.apply(bot, params));
    }

    private static async handleUserVerification(bot: HackerEmbassyBot, vId: number, language: string, msg: TelegramBot.Message) {
        const tgUser = (await bot.getChat(vId)) as ITelegramUser;

        if (ServiceHandlers.verifyAndAddUser(tgUser, language)) {
            try {
                botConfig.moderatedChats.forEach(chatId =>
                    bot.restrictChatMember(chatId, tgUser.id as number, FULL_PERMISSIONS).catch(error => logger.error(error))
                );

                await ServiceHandlers.welcomeHandler(bot, msg.chat, tgUser, language);
                await bot.deleteMessage(msg.chat.id, msg.message_id);
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
        try {
            // I hate topics in tg 🤬
            const messageToUpdate =
                msg.reply_to_message && msg.reply_to_message.message_thread_id !== msg.reply_to_message.message_id
                    ? msg.reply_to_message
                    : msg;

            await bot.editMessageReplyMarkup(
                {
                    inline_keyboard: [],
                },
                {
                    message_id: messageToUpdate.message_id,
                    chat_id: messageToUpdate.chat.id,
                }
            );
        } catch (error) {
            logger.error(error);
            await bot.sendMessageExt(msg.chat.id, t("service.removebuttons.error"), msg);
        }
    }

    static async newMemberHandler(bot: HackerEmbassyBot, memberUpdated: ChatMemberUpdated) {
        if (!(memberUpdated.old_chat_member.status === "left" && memberUpdated.new_chat_member.status === "member")) {
            return;
        }

        const user = memberUpdated.new_chat_member.user;
        const chat = memberUpdated.chat;
        const currentUser = UsersRepository.getByUserId(user.id);

        if (!botConfig.moderatedChats.includes(chat.id)) {
            return await ServiceHandlers.welcomeHandler(bot, chat, user, currentUser?.language ?? DEFAULT_LANGUAGE);
        }

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

        await ServiceHandlers.setLanguageHandler(bot, { chat, from: user, message_id: 0, date: memberUpdated.date }, undefined, {
            vId: user.id,
            name: userLink(user),
        });
    }

    static verifyAndAddUser(tgUser: ITelegramUser, language: string = DEFAULT_LANGUAGE) {
        const user = UsersRepository.getByUserId(tgUser.id);

        if (!user) throw new Error(`Restricted user ${tgUser.username} with id ${tgUser.id} should exist`);

        if (!user.roles.includes("restricted")) {
            logger.info(`User [${tgUser.id}](${tgUser.username}) was already verified`);
            return true;
        }

        logger.info(`User [${tgUser.id}](${tgUser.username}) passed the verification`);

        return UsersRepository.updateUser({ ...user, roles: "default", language });
    }

    static async welcomeHandler(bot: HackerEmbassyBot, chat: TelegramBot.Chat, tgUser: ITelegramUser, language?: string) {
        await bot.sendMessageExt(
            chat.id,
            t(WelcomeMessageMap[chat.id] ?? "service.welcome.main", { botName: bot.Name, newMember: userLink(tgUser) }, language),
            null
        );
    }

    static async setLanguageHandler(
        bot: HackerEmbassyBot,
        msg: Message,
        lang?: string,
        verificationDetails?: { vId: number; name: string }
    ) {
        if (!lang) {
            const inline_keyboard = [
                [
                    InlineButton("🇷🇺 Русский", "setlanguage", ButtonFlags.Simple, {
                        params: "ru",
                        vId: verificationDetails?.vId,
                    }),
                    InlineButton("🇺🇸 English", "setlanguage", ButtonFlags.Simple, {
                        params: "en",
                        vId: verificationDetails?.vId,
                    }),
                ],
            ];

            return await bot.sendMessageExt(
                msg.chat.id,
                t(verificationDetails ? "service.welcome.confirm" : "service.setlanguage.select", {
                    newMember: verificationDetails?.name,
                }),
                msg,
                {
                    reply_markup: { inline_keyboard },
                }
            );
        }

        if (!SUPPORTED_LANGUAGES.includes(lang)) {
            return await bot.sendMessageExt(msg.chat.id, t("service.setlanguage.notsupported", { language: lang }), msg);
        }

        const userId = msg.from?.id;
        const user = userId ? UsersRepository.getByUserId(userId) : null;

        if (user && UsersRepository.updateUser({ ...user, language: lang })) {
            bot.context(msg).language = lang;
            return await bot.sendMessageExt(msg.chat.id, t("service.setlanguage.success", { language: lang }), msg);
        }

        return await bot.sendMessageExt(msg.chat.id, t("service.setlanguage.error", { language: lang }), msg);
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
                await bot.sendMessageExt(msg.chat.id, t("general.chatnotallowed"), msg);
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
