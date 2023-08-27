import UsersHelper from "../../services/usersHelper";
import UsersRepository from "../../repositories/usersRepository";
import config from "config";

import StatusHandlers from "./status";
import FundsHandlers from "./funds";
import NeedsHandlers from "./needs";
import BirthdayHandlers from "./birthday";
import BasicHandlers from "./basic";
import EmbassyHandlers from "./embassy";

const botConfig = config.get("bot") as any;

import t from "../../services/localization";
import { setMenu } from "../bot-menu";
import RateLimiter from "../../services/RateLimiter";
import logger from "../../services/logger";

export default class ServiceHandlers {
    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async clearHandler(bot, msg, count) {
        const inputCount = Number(count);
        const countToClear = inputCount > 0 ? inputCount : 1;
        const orderOfLastMessage = msg.reply_to_message?.message_id
            ? bot.messageHistory.orderOf(msg.chat.id, msg.reply_to_message.message_id)
            : 0;

        let messagesRemained = countToClear;
        while (messagesRemained > 0) {
            const message = await bot.messageHistory.pop(msg.chat.id, orderOfLastMessage);
            if (!message) return;

            const success = await bot.deleteMessage(msg.chat.id, message.messageId).catch(() => false);
            if (success) messagesRemained--;
        }
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async combineHandler(bot, msg, count) {
        const inputCount = Number(count);
        const countToCombine = inputCount > 2 ? inputCount : 2;

        const orderOfLastMessageToEdit = msg.reply_to_message?.message_id
            ? bot.messageHistory.orderOf(msg.chat.id, msg.reply_to_message.message_id)
            : 0;

        if (orderOfLastMessageToEdit === -1) return;

        let lastMessageToEdit;
        let foundLast = false;

        do {
            lastMessageToEdit = await bot.messageHistory.pop(msg.chat.id, orderOfLastMessageToEdit);
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
            const message = await bot.messageHistory.pop(msg.chat.id, orderOfLastMessageToEdit);
            if (!message) break;

            const success = await bot.deleteMessage(msg.chat.id, message.messageId).catch(() => false);
            // TODO combining images into one message
            if (success) {
                preparedMessages.push(message);
                messagesRemained--;
            }
        }

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

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async chatidHandler(bot, msg) {
        await bot.sendMessageExt(msg.chat.id, `chatId: ${msg.chat.id}, topicId: ${msg.message_thread_id}`, msg);
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async residentMenuHandler(bot, msg) {
        UsersRepository.setUserid(msg.from.username ?? msg.from.first_name, msg.from.id);

        await setMenu(bot);

        bot.sendMessageExt(
            msg.chat.id,
            `Resident menu is enabled for ${msg.from.username}[userid:${msg.from.id}] in the private chat`,
            msg
        );
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async superstatusHandler(bot, msg) {
        await StatusHandlers.statusHandler(bot, msg);
        await EmbassyHandlers.webcamHandler(bot, msg);
        await EmbassyHandlers.webcam2Handler(bot, msg);
        await EmbassyHandlers.doorcamHandler(bot, msg);
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {CallbackQuery} callbackQuery
     */
    static async callbackHandler(bot, callbackQuery) {
        const msg = callbackQuery.message;

        try {
            bot.context(msg).messageThreadId = msg.message_thread_id;

            await RateLimiter.throttle(ServiceHandlers.routeQuery, [bot, callbackQuery, msg], msg.from.id, ServiceHandlers);
        } catch (error) {
            logger.log(error);
        } finally {
            bot.context(msg).clear();
        }
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async routeQuery(bot, callbackQuery, msg) {
        const data = JSON.parse(callbackQuery.data);

        msg.from = callbackQuery.from;

        const isAllowed = bot.canUserCall.bind(bot, msg.from.username);

        switch (data.command) {
            case "/in":
                await StatusHandlers.inHandler(bot, msg);
                break;
            case "/out":
                await StatusHandlers.outHandler(bot, msg);
                break;
            case "/going":
                await StatusHandlers.goingHandler(bot, msg);
                break;
            case "/notgoing":
                await StatusHandlers.notGoingHandler(bot, msg);
                break;
            case "/open":
                if (isAllowed(StatusHandlers.openHandler)) await StatusHandlers.openHandler(bot, msg);
                break;
            case "/close":
                if (isAllowed(StatusHandlers.closeHandler)) await StatusHandlers.closeHandler(bot, msg);
                break;
            case "/status":
                await StatusHandlers.statusHandler(bot, msg);
                break;
            case "/ustatus":
                bot.context(msg).isEditing = true;
                await StatusHandlers.statusHandler(bot, msg);
                break;
            case "/superstatus":
                if (isAllowed(this.superstatusHandler)) await this.superstatusHandler(bot, msg);
                break;
            case "/birthdays":
                await BirthdayHandlers.birthdayHandler(bot, msg);
                break;
            case "/needs":
                await NeedsHandlers.needsHandler(bot, msg);
                break;
            case "/funds":
                await FundsHandlers.fundsHandler(bot, msg);
                break;
            case "/startpanel":
                bot.context(msg).isEditing = true;
                await BasicHandlers.startPanelHandler(bot, msg);
                break;
            case "/infopanel":
                bot.context(msg).isEditing = true;
                await BasicHandlers.infoPanelHandler(bot, msg);
                break;
            case "/controlpanel":
                if (isAllowed(BasicHandlers.controlPanelHandler)) {
                    bot.context(msg).isEditing = true;
                    await BasicHandlers.controlPanelHandler(bot, msg);
                }
                break;
            case "/about":
                await BasicHandlers.aboutHandler(bot, msg);
                break;
            case "/help":
                await BasicHandlers.helpHandler(bot, msg);
                break;
            case "/donate":
                await BasicHandlers.donateHandler(bot, msg);
                break;
            case "/join":
                await BasicHandlers.joinHandler(bot, msg);
                break;
            case "/events":
                await BasicHandlers.eventsHandler(bot, msg);
                break;
            case "/location":
                await BasicHandlers.locationHandler(bot, msg);
                break;
            case "/getresidents":
                await BasicHandlers.getResidentsHandler(bot, msg);
                break;
            case "/ef":
                await FundsHandlers.exportCSVHandler(bot, msg, data.params[0]);
                break;
            case "/ed":
                await FundsHandlers.exportDonutHandler(bot, msg, data.params[0]);
                break;
            case "/unlock":
                if (isAllowed(EmbassyHandlers.unlockHandler)) await EmbassyHandlers.unlockHandler(bot, msg);
                break;
            case "/doorbell":
                if (isAllowed(EmbassyHandlers.doorbellHandler)) await EmbassyHandlers.doorbellHandler(bot, msg);
                break;
            case "/webcam":
                if (isAllowed(EmbassyHandlers.webcamHandler)) await EmbassyHandlers.webcamHandler(bot, msg);
                break;
            case "/webcam2":
                if (isAllowed(EmbassyHandlers.webcam2Handler)) await EmbassyHandlers.webcam2Handler(bot, msg);
                break;
            case "/doorcam":
                if (isAllowed(EmbassyHandlers.doorcamHandler)) await EmbassyHandlers.doorcamHandler(bot, msg);
                break;
            case "/printers":
                await EmbassyHandlers.printersHandler(bot, msg);
                break;
            case "/printerstatus anette":
            case "/anettestatus":
                await EmbassyHandlers.printerStatusHandler(bot, msg, "anette");
                break;
            case "/printerstatus plumbus":
            case "/plumbusstatus":
                await EmbassyHandlers.printerStatusHandler(bot, msg, "plumbus");
                break;
            case "/bought":
                await this.boughtButtonHandler(bot, msg, data.id, data);
                break;
            case "/bought_undo":
                if (NeedsHandlers.boughtUndoHandler(bot, msg, data.id)) {
                    await bot.deleteMessage(msg.chat.id, msg.message_id);
                }
                break;
            default:
                break;
        }

        await bot.answerCallbackQuery(callbackQuery.id);
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async newMemberHandler(bot, msg) {
        const botName = (await bot.getMe()).username;
        const newMembers = msg.new_chat_members.reduce(
            (res, member) =>
                res +
                `${member?.username ? UsersHelper.formatUsername(member.username, bot.context(msg).mode) : member?.first_name} `,
            ""
        );

        let welcomeText;

        switch (msg.chat.id) {
            case botConfig.chats.offtopic:
                welcomeText = t("service.welcome.offtopic", { botName, newMembers });
                break;
            case botConfig.chats.key:
                welcomeText = t("service.welcome.key", { botName, newMembers });
                break;
            case botConfig.chats.horny:
                welcomeText = t("service.welcome.horny", { botName, newMembers });
                break;
            case botConfig.chats.main:
            default:
                welcomeText = t("service.welcome.main", { botName, newMembers });
        }

        bot.sendMessageExt(msg.chat.id, welcomeText, msg);
    }

    /**
     * @param {HackerEmbassyBot} bot
     */
    static async boughtButtonHandler(bot, message, id, data) {
        await NeedsHandlers.boughtByIdHandler(bot, message, id);

        const new_keyboard = message.reply_markup.inline_keyboard.filter(button => button[0].callback_data !== data);

        if (new_keyboard.length != message.reply_markup.inline_keyboard.length) {
            await bot.editMessageReplyMarkup(
                { inline_keyboard: new_keyboard },
                {
                    chat_id: message.chat.id,
                    message_id: message.message_id,
                }
            );
        }
    }
}
