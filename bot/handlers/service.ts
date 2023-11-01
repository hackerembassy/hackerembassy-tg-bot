import config from "config";
import TelegramBot, { ChatMemberUpdated, InlineKeyboardButton, Message } from "node-telegram-bot-api";

import { BotConfig } from "../../config/schema";
import UsersRepository from "../../repositories/usersRepository";
import t from "../../services/localization";
import logger from "../../services/logger";
import RateLimiter from "../../services/RateLimiter";
import { userLink } from "../../services/usersHelper";
import { sleep } from "../../utils/common";
import HackerEmbassyBot, { BotHandlers, FULL_PERMISSIONS, ITelegramUser, RESTRICTED_PERMISSIONS } from "../core/HackerEmbassyBot";
import { MessageHistoryEntry } from "../core/MessageHistory";
import { setMenu } from "../init/menu";
import BasicHandlers from "./basic";
import BirthdayHandlers from "./birthday";
import EmbassyHandlers, { embassyBase } from "./embassy";
import FundsHandlers from "./funds";
import MemeHandlers from "./meme";
import NeedsHandlers from "./needs";
import StatusHandlers from "./status";

const botConfig = config.get<BotConfig>("bot");

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
        const data = callbackQuery.data ? JSON.parse(callbackQuery.data) : undefined;

        if (!data) throw Error("Missing calback query data");

        msg.from = callbackQuery.from;

        const isAllowed = bot.canUserCall.bind(bot, msg.from.username);

        if (data.vId && callbackQuery.from.id === data.vId) {
            const tgUser = (await bot.getChat(data.vId)) as ITelegramUser;

            if (ServiceHandlers.verifyUserHandler(tgUser)) {
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
            case "/s_ustatus":
                bot.context(msg).isEditing = true;
                bot.context(msg).mode.pin = true;
                await StatusHandlers.statusHandler(bot, msg);
                break;
            case "/superstatus":
                if (isAllowed(ServiceHandlers.superstatusHandler)) await ServiceHandlers.superstatusHandler(bot, msg);
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
            case "/memepanel":
                if (isAllowed(BasicHandlers.memePanelHandler)) {
                    bot.context(msg).isEditing = true;
                    await BasicHandlers.memePanelHandler(bot, msg);
                }
                break;
            case "/conditioner":
                if (isAllowed(EmbassyHandlers.conditionerHandler)) {
                    bot.context(msg).isEditing = true;
                    await EmbassyHandlers.conditionerHandler(bot, msg);
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
                await FundsHandlers.exportCSVHandler(bot, msg, data.opt[0]);
                break;
            case "/ed":
                await FundsHandlers.exportDonutHandler(bot, msg, data.opt[0]);
                break;
            case "/unlock":
                if (isAllowed(EmbassyHandlers.unlockHandler)) await EmbassyHandlers.unlockHandler(bot, msg);
                break;
            case "/doorbell":
                if (isAllowed(EmbassyHandlers.doorbellHandler)) await EmbassyHandlers.doorbellHandler(bot, msg);
                break;
            case "/webcam":
                bot.context(msg).isEditing = data.edit ?? false;
                if (isAllowed(EmbassyHandlers.webcamHandler)) await EmbassyHandlers.webcamHandler(bot, msg);
                break;
            case "/webcam2":
                bot.context(msg).isEditing = data.edit ?? false;
                if (isAllowed(EmbassyHandlers.webcam2Handler)) await EmbassyHandlers.webcam2Handler(bot, msg);
                break;
            case "/doorcam":
                bot.context(msg).isEditing = data.edit ?? false;
                if (isAllowed(EmbassyHandlers.doorcamHandler)) await EmbassyHandlers.doorcamHandler(bot, msg);
                break;
            case "/removeButtons":
                await ServiceHandlers.removeButtons(bot, msg);
                break;
            case "/printers":
                await EmbassyHandlers.printersHandler(bot, msg);
                break;
            case "/uanettestatus":
                bot.context(msg).isEditing = true;
                bot.context(msg).mode.silent = true;
                await EmbassyHandlers.printerStatusHandler(bot, msg, "anette");
                break;
            case "/anettestatus":
                await EmbassyHandlers.printerStatusHandler(bot, msg, "anette");
                break;
            case "/uplumbusstatus":
                bot.context(msg).isEditing = true;
                bot.context(msg).mode.silent = true;
                await EmbassyHandlers.printerStatusHandler(bot, msg, "plumbus");
                break;
            case "/plumbusstatus":
                await EmbassyHandlers.printerStatusHandler(bot, msg, "plumbus");
                break;
            case "/uconditioner":
                bot.context(msg).isEditing = true;
                if (isAllowed(EmbassyHandlers.conditionerHandler)) await EmbassyHandlers.conditionerHandler(bot, msg);
                break;
            case "/turnconditioneron":
                if (isAllowed(EmbassyHandlers.turnConditionerHandler))
                    await ServiceHandlers.conditionerCallback(bot, msg, async () => {
                        await EmbassyHandlers.turnConditionerHandler(bot, msg, true);
                    });
                break;
            case "/turnconditioneroff":
                if (isAllowed(EmbassyHandlers.turnConditionerHandler))
                    await ServiceHandlers.conditionerCallback(bot, msg, async () => {
                        await EmbassyHandlers.turnConditionerHandler(bot, msg, false);
                    });
                break;
            case "/addconditionertemp":
                if (isAllowed(EmbassyHandlers.turnConditionerHandler))
                    await ServiceHandlers.conditionerCallback(bot, msg, async () => {
                        await EmbassyHandlers.addConditionerTempHandler(bot, msg, data.diff);
                    });
                break;
            case "/setconditionermode":
                if (isAllowed(EmbassyHandlers.turnConditionerHandler))
                    await ServiceHandlers.conditionerCallback(bot, msg, async () => {
                        await EmbassyHandlers.setConditionerModeHandler(bot, msg, data.mode);
                    });
                break;
            case "/bought":
                await ServiceHandlers.boughtButtonHandler(bot, msg, data.id, data);
                break;
            case "/bought_undo":
                if (NeedsHandlers.boughtUndoHandler(bot, msg, data.id)) {
                    await bot.deleteMessage(msg.chat.id, msg.message_id);
                }
                break;
            case "/randomcat":
                await MemeHandlers.randomCatHandler(bot, msg);
                break;
            case "/randomdog":
                await MemeHandlers.randomDogHandler(bot, msg);
                break;
            case "/randomcab":
                await MemeHandlers.randomCabHandler(bot, msg);
                break;
            case "/randomcock":
                await MemeHandlers.randomRoosterHandler(bot, msg);
                break;
            case "/moan":
                bot.context(msg).mode.silent = true;
                await EmbassyHandlers.playinspaceHandler(bot, msg, "http://soundjax.com/reddo/24227%5EMOAN.mp3");
                break;
            case "/fart":
                bot.context(msg).mode.silent = true;
                await EmbassyHandlers.playinspaceHandler(bot, msg, "https://www.tones7.com/media/farts.mp3");
                break;
            case "/adler":
                bot.context(msg).mode.silent = true;
                await EmbassyHandlers.playinspaceHandler(bot, msg, `${embassyBase}/adler.mp3`);
                break;
            case "/rickroll":
                bot.context(msg).mode.silent = true;
                await EmbassyHandlers.playinspaceHandler(bot, msg, `${embassyBase}/rickroll.mp3`);
                break;
            case "/rzd":
                bot.context(msg).mode.silent = true;
                await EmbassyHandlers.playinspaceHandler(bot, msg, `${embassyBase}/rzd.mp3`);
                break;
            case "/rfoxed":
                bot.context(msg).mode.silent = true;
                await EmbassyHandlers.playinspaceHandler(bot, msg, `${embassyBase}/rfoxed.mp3`);
                break;
            case "/zhuchok":
                bot.context(msg).mode.silent = true;
                await EmbassyHandlers.playinspaceHandler(bot, msg, `${embassyBase}/zhuchok.mp3`);
                break;
            case "/nani":
                bot.context(msg).mode.silent = true;
                await EmbassyHandlers.playinspaceHandler(bot, msg, `${embassyBase}/nani.mp3`);
                break;
            default:
                break;
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
        const inline_keyboard = [
            [
                {
                    text: t("service.welcome.captcha"),
                    callback_data: JSON.stringify({ vId: user.id }),
                },
            ],
        ];

        await bot.sendMessageExt(chat.id, welcomeText, null, {
            reply_markup: { inline_keyboard },
        });
    }

    static verifyUserHandler(tgUser: ITelegramUser) {
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

    static async boughtButtonHandler(bot: HackerEmbassyBot, message: Message, id: number, data: string) {
        await NeedsHandlers.boughtByIdHandler(bot, message, id);

        if (!message.reply_markup) return;

        const new_keyboard = message.reply_markup.inline_keyboard.filter(
            (button: InlineKeyboardButton[]) => button[0].callback_data !== data
        );

        if (new_keyboard.length !== message.reply_markup.inline_keyboard.length) {
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
