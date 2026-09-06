import config from "config";

import { ChatMemberUpdated, Message } from "node-telegram-bot-api";

import { BotConfig } from "@config";
import UsersRepository from "@data/repositories/users";
import ApiKeysRepository from "@data/repositories/apikeys";
import logger from "@services/common/logger";
import { generateRandomKey, sha256 } from "@utils/security";
import {
    AllowedChats,
    FeatureFlag,
    GreetingsChats,
    Members,
    NonTopicChats,
    PublicChats,
    Route,
    TrustedMembers,
    UserRoles,
} from "@hackembot/core/decorators";

import { openwebui } from "@services/neural/openwebui";
import { hasRole } from "@services/domain/user";
import { splitArray } from "@utils/common";
import {
    COMPACT_DURATION_REGEX,
    TIME_RANGE_KEYWORDS,
    getTimeRange,
    isCompactDurationToken,
    isTimeRangeKeyword,
    tryDurationStringToMs,
} from "@utils/date";

import { MAX_MESSAGE_LENGTH_WITH_TAGS } from "../core/constants";
import HackerEmbassyBot from "../core/classes/HackerEmbassyBot";
import { ButtonFlags, InlineButton } from "../core/inlineButtons";
import t, { DEFAULT_LANGUAGE, isSupportedLanguage, PUBLIC_LANGUAGES, TEST_LANGUAGE } from "../core/localization";
import { BotController, MessageHistoryEntry } from "../core/types";
import { OptionalParam, tgUserLink } from "../core/helpers";
import EmbassyController from "./embassy";
import StatusController from "./status";

const botConfig = config.get<BotConfig>("bot");

const DeprecatedReplacementMap = new Map<string, string>([["knock", "hey"]]);

export default class ServiceController implements BotController {
    @Route(["clear"], OptionalParam(/(\d*)/), match => [match[1]])
    @UserRoles(Members)
    static async clearHandler(bot: HackerEmbassyBot, msg: Message, count: string) {
        const inputCount = Number(count);
        const countToClear = inputCount > 0 ? inputCount : 1;
        const orderOfLastMessage = msg.reply_to_message?.message_id
            ? bot.botMessageHistory.orderOf(msg.chat.id, msg.reply_to_message.message_id)
            : 0;

        if (orderOfLastMessage === undefined || orderOfLastMessage === null || orderOfLastMessage === -1) return;

        let messagesRemained = countToClear;
        while (messagesRemained > 0) {
            const message = bot.botMessageHistory.pop(msg.chat.id, orderOfLastMessage);
            if (!message) return;

            const success = await bot.deleteMessage(msg.chat.id, message.messageId).catch(() => false);
            if (success) messagesRemained--;
        }
    }

    @Route(
        ["tldr"],
        OptionalParam(new RegExp(`(${TIME_RANGE_KEYWORDS.join("|")}|${COMPACT_DURATION_REGEX.source}|\\d*)(?: (.+))?`)),
        match => [match[1], match[2]]
    )
    @UserRoles(TrustedMembers)
    @AllowedChats(PublicChats)
    @FeatureFlag("ai")
    @FeatureFlag("history")
    static async tldrHandler(bot: HackerEmbassyBot, msg: Message, token: string, promptOverride?: string) {
        if (!NonTopicChats.includes(msg.chat.id)) {
            return bot.sendMessageExt(msg.chat.id, t("service.tldr.notready"), msg);
        }

        let selectedMessages: MessageHistoryEntry[];

        if (token && isTimeRangeKeyword(token)) {
            const { fromMs, toMs } = getTimeRange(token);
            selectedMessages = bot.messageHistory.getInRange(msg.chat.id, fromMs, toMs);
        } else if (token && isCompactDurationToken(token)) {
            selectedMessages = bot.messageHistory.getInRange(msg.chat.id, Date.now() - (tryDurationStringToMs(token) ?? 0));
        } else {
            const countToSummarize = Number(token);

            if (Number.isNaN(countToSummarize) || countToSummarize < 0 || countToSummarize > botConfig.history.messagesLimit) {
                return bot.sendMessageExt(msg.chat.id, t("service.tldr.help"), msg);
            }

            const chatHistory = bot.messageHistory.getAll(msg.chat.id).toReversed();
            selectedMessages = countToSummarize > 0 ? chatHistory.slice(-countToSummarize) : chatHistory;
        }

        if (selectedMessages.length === 0) {
            return bot.sendMessageExt(msg.chat.id, t("service.tldr.empty"), msg);
        }

        let prompt = promptOverride ?? t("service.tldr.prompt") + "\n\n";
        for (const message of selectedMessages) {
            if (message.text) prompt += `${message.from}: ${message.text}\n`;
        }

        return bot.sendStreamedMessage(
            msg.chat.id,
            await openwebui.generateOpenAiStream(prompt, undefined, botConfig.history.summaryModel),
            msg,
            { parse_mode: "GFM" }
        );
    }

    @Route(["digest"])
    @UserRoles(TrustedMembers)
    @AllowedChats(PublicChats)
    @FeatureFlag("dailydigest")
    static async sendDailyDigestHandler(bot: HackerEmbassyBot, msg: Nullable<Message>) {
        // Pass null, not msg, to sendMessageExt below - a "-forward" modifier on msg would redirect the reply elsewhere.
        if (msg && !NonTopicChats.includes(msg.chat.id)) {
            return bot.sendMessageExt(msg.chat.id, t("service.tldr.notready"), null);
        }

        // Interactive calls summarize the chat they were run in; the cron job (msg === null) always targets main.
        const chatId = msg?.chat.id ?? botConfig.chats.main;
        const notifyEmpty = () => (msg ? bot.sendMessageExt(chatId, t("service.tldr.empty"), null) : undefined);

        try {
            const { fromMs, toMs } = getTimeRange("yesterday");
            const selectedMessages = bot.messageHistory.getInRange(chatId, fromMs, toMs);

            if (selectedMessages.length === 0) return notifyEmpty();

            let prompt = "";
            for (const message of selectedMessages) {
                if (message.text) prompt += `${message.from}: ${message.text}\n`;
            }

            const summary = await openwebui.generateOpenAi(prompt, undefined, botConfig.history.digestModel);

            if (!summary.trim()) return notifyEmpty();

            const text = `${t("service.digest.header")}\n\n${summary}`;

            return await bot.sendMessageExt(chatId, text, null, { parse_mode: "GFM" });
        } catch (error) {
            logger.error(`Failed to send daily digest: ${(error as Error).message}`);
            return;
        }
    }

    @Route(["combine", "squash", "sq"], OptionalParam(/(\d*)/), match => [match[1]])
    @UserRoles(Members)
    static async combineHandler(bot: HackerEmbassyBot, msg: Message, count: string) {
        const inputCount = Number(count);
        const countToCombine = Math.max(inputCount, 2);

        const orderOfLastMessageToEdit = msg.reply_to_message?.message_id
            ? bot.botMessageHistory.orderOf(msg.chat.id, msg.reply_to_message.message_id)
            : 0;

        if (orderOfLastMessageToEdit === undefined || orderOfLastMessageToEdit === null || orderOfLastMessageToEdit === -1)
            return;

        let lastMessageToEdit: Nullable<MessageHistoryEntry>;
        let foundLast = false;

        // find a suitable message to edit (because images are not supported yet)
        do {
            lastMessageToEdit = bot.botMessageHistory.pop(msg.chat.id, orderOfLastMessageToEdit);
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
            const message = bot.botMessageHistory.get(msg.chat.id, orderOfLastMessageToEdit);
            const messageLength = message?.text?.length ?? 0;

            if (!message) break;
            if (combinedMessageLength + messageLength > MAX_MESSAGE_LENGTH_WITH_TAGS) break;

            bot.botMessageHistory.pop(msg.chat.id, orderOfLastMessageToEdit);
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

        bot.botMessageHistory.push(
            msg.chat.id,
            { messageId: lastMessageToEdit.messageId, text: combinedMessageText },
            orderOfLastMessageToEdit
        );

        if (combinedMessageText !== lastMessageToEdit.text) {
            await bot.editMessageTextExt(combinedMessageText, msg, {
                chat_id: msg.chat.id,
                message_id: lastMessageToEdit.messageId,
            });
        }
    }

    @Route(["chatid"])
    static async chatidHandler(bot: HackerEmbassyBot, msg: Message) {
        if (msg.chat.type === "private") {
            await bot.sendMessageExt(msg.chat.id, `chatId: ${msg.chat.id}`, msg);
        } else if (hasRole(bot.context(msg).user, "admin", "member")) {
            await bot.sendMessageExt(msg.chat.id, `chatId: ${msg.chat.id}, topicId: ${msg.message_thread_id}`, msg);
        } else {
            await bot.sendRestrictedMessage(msg);
        }
    }

    @Route(["knock"])
    static deprecatedHandler(bot: HackerEmbassyBot, msg: Message) {
        const command = bot.context(msg).command;
        const replacement = command ? DeprecatedReplacementMap.get(command) : undefined;

        const text =
            t("service.deprecated.notsupported", { command }) +
            (replacement ? "\n" + t("service.deprecated.replaced", { replacement }) : "");

        void bot.sendTemporaryMessage(msg.chat.id, text, msg);
    }

    @Route(["superstatus", "ss"])
    @UserRoles(Members)
    static async superstatusHandler(bot: HackerEmbassyBot, msg: Message) {
        await StatusController.statusHandler(bot, msg);
        await EmbassyController.allCamsHandler(bot, msg);
    }

    @Route(["removebuttons", "rb", "static"])
    @UserRoles(Members)
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
        try {
            const tgUser = memberUpdated.new_chat_member.user;
            const chat = memberUpdated.chat;
            const isGreetingsChat = GreetingsChats.includes(chat.id);
            const isReturningMember =
                memberUpdated.old_chat_member.status === "left" && memberUpdated.new_chat_member.status === "member";

            if (!isGreetingsChat || !isReturningMember) {
                return;
            }

            const currentUser = UsersRepository.getUserByUserId(tgUser.id);

            if (!botConfig.features.antispam || !botConfig.moderatedChats.includes(chat.id)) {
                if (botConfig.features.welcome)
                    await bot.sendWelcomeMessage(chat, tgUser, currentUser?.language ?? DEFAULT_LANGUAGE);

                return;
            }

            if (!currentUser) {
                UsersRepository.addUser(tgUser.id, tgUser.username, ["restricted"]);

                void bot.lockChatMember(chat.id, tgUser.id);

                logger.info(
                    `New user [${tgUser.id}](${tgUser.username}) joined the chat [${chat.id}](${chat.title}) as restricted`
                );
            } else if (currentUser.roles?.includes("restricted")) {
                void bot.lockChatMember(chat.id, tgUser.id);

                logger.info(
                    `Restricted user [${tgUser.id}](${tgUser.username}) joined the chat [${chat.id}](${chat.title}) again`
                );
            } else {
                logger.info(
                    `Known user [${currentUser.userid}](${currentUser.username}) joined the chat [${chat.id}](${chat.title})`
                );

                if (botConfig.features.welcome) await bot.sendWelcomeMessage(chat, tgUser);

                return;
            }

            await ServiceController.setLanguageHandler(
                bot,
                { chat, from: tgUser, message_id: 0, date: memberUpdated.date },
                undefined,
                {
                    vId: tgUser.id,
                    name: tgUserLink(tgUser),
                }
            );
        } catch (error) {
            logger.error(`Failed to handle new member in chat ${memberUpdated.chat.id}`);
            logger.debug(error);
        }
    }

    @Route(["setlanguage", "setlang", "lang", "language"], OptionalParam(/(\S+)/), match => [match[1]])
    @Route(["ru", "rus", "russian"], null, () => ["ru"])
    @Route(["en", "eng", "english"], null, () => ["en"])
    @Route(["hy", "hye", "armenian"], null, () => ["hy"])
    @Route(["uk", "ukr", "ukrainian", "ua"], null, () => ["uk"])
    @Route(["eo", "epo", "esperanto"], null, () => ["eo"])
    static async setLanguageHandler(
        bot: HackerEmbassyBot,
        msg: Message,
        lang?: string,
        verificationDetails?: { vId: number; name: string }
    ) {
        if (!lang) {
            const keyboardRowsCount = 3;
            const publicLanguageGroups = splitArray([...PUBLIC_LANGUAGES], keyboardRowsCount);
            const inline_keyboard = publicLanguageGroups.map(group =>
                group.map(lang =>
                    InlineButton(`${lang.flag} ${lang.label}`, "setlanguage", ButtonFlags.Simple, {
                        params: lang.code,
                        vId: verificationDetails?.vId,
                    })
                )
            );
            // Ban this bot outta here
            if (verificationDetails?.vId) {
                inline_keyboard.at(-1)?.push(
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

        if (!isSupportedLanguage(lang) || lang === TEST_LANGUAGE)
            return bot.sendMessageExt(msg.chat.id, t("service.setlanguage.notsupported", { language: lang }), msg);

        const user = bot.context(msg).user;

        if (UsersRepository.updateUser(user.userid, { language: lang })) {
            bot.context(msg).language = lang;
            return await bot.sendMessageExt(msg.chat.id, t("service.setlanguage.success", { language: lang }), msg);
        }

        return await bot.sendMessageExt(msg.chat.id, t("service.setlanguage.error", { language: lang }), msg);
    }

    @Route(["token"], OptionalParam(/(\S+?)/), match => [match[1]])
    @UserRoles(TrustedMembers)
    static tokenHandler(bot: HackerEmbassyBot, msg: Message, command: string) {
        const context = bot.context(msg);

        if (!context.isPrivate()) return bot.sendMessageExt(msg.chat.id, t("service.token.private"), msg);

        const user = context.user;
        const key = ApiKeysRepository.getKeyByUser(user.userid);

        switch (command) {
            case "set": {
                if (key) return bot.sendMessageExt(msg.chat.id, t("service.token.exists"), msg);

                const newKey = generateRandomKey();
                ApiKeysRepository.addKey(user.userid, sha256(newKey));

                return bot.sendMessageExt(msg.chat.id, t("service.token.set", { token: newKey }), msg);
            }
            case "remove": {
                if (!key) return bot.sendMessageExt(msg.chat.id, t("service.token.missing"), msg);
                ApiKeysRepository.removeKey(key.id);

                return bot.sendMessageExt(msg.chat.id, t("service.token.removed"), msg);
            }
            case "help":
            default: {
                return bot.sendMessageExt(
                    msg.chat.id,
                    `${t("service.token.help")}\n${t(key ? "service.token.found" : "service.token.notfound")}`,
                    msg
                );
            }
        }
    }
}
