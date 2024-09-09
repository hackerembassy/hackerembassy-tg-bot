import config from "config";

import { ChatMemberUpdated, Message } from "node-telegram-bot-api";

import { BotConfig } from "@config";
import UsersRepository from "@repositories/users";
import logger from "@services/logger";

import { MAX_MESSAGE_LENGTH_WITH_TAGS } from "../core/constants";
import HackerEmbassyBot from "../core/HackerEmbassyBot";
import { ButtonFlags, InlineButton } from "../core/InlineButtons";
import t, { DEFAULT_LANGUAGE, isSupportedLanguage } from "../core/localization";
import { BotHandlers, MessageHistoryEntry } from "../core/types";
import { tgUserLink } from "../core/helpers";
import EmbassyHandlers from "./embassy";
import StatusHandlers from "./status";

const botConfig = config.get<BotConfig>("bot");

const DeprecatedReplacementMap = new Map<string, string>([["knock", "hey"]]);

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
        } else if (bot.context(msg).user.roles?.includes("member")) {
            await bot.sendMessageExt(msg.chat.id, `chatId: ${msg.chat.id}, topicId: ${msg.message_thread_id}`, msg);
        } else {
            bot.sendRestrictedMessage(msg);
        }
    }

    static deprecatedHandler(bot: HackerEmbassyBot, msg: Message) {
        const command = bot.context(msg).command;
        const replacement = command ? DeprecatedReplacementMap.get(command) : undefined;

        const text =
            t("service.deprecated.notsupported", { command }) +
            (replacement ? "\n" + t("service.deprecated.replaced", { replacement }) : "");

        bot.sendTemporaryMessage(msg.chat.id, text, msg);
    }

    static async superstatusHandler(bot: HackerEmbassyBot, msg: Message) {
        await StatusHandlers.statusHandler(bot, msg);
        await EmbassyHandlers.allCamsHandler(bot, msg);
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

        const tgUser = memberUpdated.new_chat_member.user;
        const chat = memberUpdated.chat;
        const currentUser = UsersRepository.getUserByUserId(tgUser.id);

        if (!botConfig.features.antispam || !botConfig.moderatedChats.includes(chat.id)) {
            if (botConfig.features.welcome) await bot.sendWelcomeMessage(chat, tgUser, currentUser?.language ?? DEFAULT_LANGUAGE);

            return;
        }

        if (!currentUser) {
            UsersRepository.addUser(tgUser.id, tgUser.username, ["restricted"]);
            bot.lockChatMember(chat.id, tgUser.id);

            logger.info(`New user [${tgUser.id}](${tgUser.username}) joined the chat [${chat.id}](${chat.title}) as restricted`);
        } else if (!currentUser.roles?.includes("restricted")) {
            logger.info(
                `Known user [${currentUser.userid}](${currentUser.username}) joined the chat [${chat.id}](${chat.title})`
            );

            if (botConfig.features.welcome) await bot.sendWelcomeMessage(chat, tgUser);

            return;
        } else {
            bot.lockChatMember(chat.id, tgUser.id);
            logger.info(`Restricted user [${tgUser.id}](${tgUser.username}) joined the chat [${chat.id}](${chat.title}) again`);
        }

        await ServiceHandlers.setLanguageHandler(
            bot,
            { chat, from: tgUser, message_id: 0, date: memberUpdated.date },
            undefined,
            {
                vId: tgUser.id,
                name: tgUserLink(tgUser),
            }
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
                    InlineButton("🇷🇺 Rus", "setlanguage", ButtonFlags.Simple, {
                        params: "ru",
                        vId: verificationDetails?.vId,
                    }),
                    InlineButton("🇬🇧 Eng", "setlanguage", ButtonFlags.Simple, {
                        params: "en",
                        vId: verificationDetails?.vId,
                    }),
                ],
            ];

            // Ban this bot outta here
            if (verificationDetails?.vId) {
                inline_keyboard[0].splice(
                    1,
                    0,
                    InlineButton("🤖", "ban", ButtonFlags.Simple, {
                        params: verificationDetails.vId,
                    })
                );
            }

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

        if (!isSupportedLanguage(lang)) {
            return await bot.sendMessageExt(msg.chat.id, t("service.setlanguage.notsupported", { language: lang }), msg);
        }

        const userId = msg.from?.id;
        const user = userId ? UsersRepository.getUserByUserId(userId) : null;

        if (user && UsersRepository.updateUser(user.userid, { language: lang })) {
            bot.context(msg).language = lang;
            return await bot.sendMessageExt(msg.chat.id, t("service.setlanguage.success", { language: lang }), msg);
        }

        return await bot.sendMessageExt(msg.chat.id, t("service.setlanguage.error", { language: lang }), msg);
    }
}
