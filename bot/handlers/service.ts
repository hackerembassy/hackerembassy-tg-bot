import config from "config";
import TelegramBot, { ChatMemberUpdated, InlineKeyboardButton, Message } from "node-telegram-bot-api";

import { BotConfig } from "../../config/schema";
import UsersRepository from "../../repositories/usersRepository";
import { ConditionerMode } from "../../services/home";
import t from "../../services/localization";
import logger from "../../services/logger";
import RateLimiter from "../../services/RateLimiter";
import { userLink } from "../../services/usersHelper";
import { sleep } from "../../utils/common";
import HackerEmbassyBot, { BotHandlers, FULL_PERMISSIONS, ITelegramUser, RESTRICTED_PERMISSIONS } from "../core/HackerEmbassyBot";
import { MessageHistoryEntry } from "../core/MessageHistory";
import { setMenu } from "../init/menu";
import EmbassyHandlers, { embassyBase } from "./embassy";
import NeedsHandlers from "./needs";
import StatusHandlers from "./status";

console.log(StatusHandlers);

const botConfig = config.get<BotConfig>("bot");

type CallbackData = {
    flags?: Flags;
    vId?: number;
    command?: string;
    id: number;
    diff?: number;
    mode?: ConditionerMode;
    edit?: boolean;
    fn?: string;
};

export enum Flags {
    Simple = 0,
    Restricted = 1 << 0, // 0001
    Editing = 1 << 1, // 0010
    Silent = 1 << 2, // 0100
    Pin = 1 << 3, // 1000
    All = ~(~0 << 4), // 1111
}

export default class ServiceHandlers implements BotHandlers {
    //@ts-ignore
    static routeMap: Map<string, any> = new Map([
        // ["/in", StatusHandlers.inHandler],
        // ["/out", StatusHandlers.inHandler],
        // ["/going", StatusHandlers.goingHandler],
        // ["/notgoing", StatusHandlers.notGoingHandler],
        // ["/status", StatusHandlers.statusHandler],
        // ["/birthdays", BirthdayHandlers.birthdayHandler],
        // ["/needs", NeedsHandlers.needsHandler],
        // ["/funds", FundsHandlers.fundsHandler],
        // ["/about", BasicHandlers.aboutHandler],
        // ["/help", BasicHandlers.helpHandler],
        // ["/donate", BasicHandlers.donateHandler],
        // ["/join", BasicHandlers.joinHandler],
        // ["/events", BasicHandlers.eventsHandler],
        // ["/location", BasicHandlers.locationHandler],
        // ["/getresidents", BasicHandlers.getResidentsHandler],
        // ["/ef", FundsHandlers.exportCSVHandler],
        // ["/ed", FundsHandlers.exportDonutHandler],
        // ["/removeButtons", ServiceHandlers.removeButtons],
        // ["/printers", EmbassyHandlers.printersHandler],
        // ["/randomcat", MemeHandlers.randomCatHandler],
        // ["/randomdog", MemeHandlers.randomDogHandler],
        // ["/randomcab", MemeHandlers.randomCabHandler],
        // ["/randomcock", MemeHandlers.randomRoosterHandler],
        // ["/open", StatusHandlers.openHandler],
        // ["/close", StatusHandlers.closeHandler],
        // ["/ustatus", StatusHandlers.statusHandler],
        // ["/s_ustatus", StatusHandlers.statusHandler],
        // ["/superstatus", ServiceHandlers.superstatusHandler],
        // ["/startpanel", BasicHandlers.startPanelHandler],
        // ["/infopanel", BasicHandlers.infoPanelHandler],
        // ["/controlpanel", BasicHandlers.controlPanelHandler],
        // ["/memepanel", BasicHandlers.memePanelHandler],
        // ["/conditioner", EmbassyHandlers.conditionerHandler],
        // ["/unlock", EmbassyHandlers.unlockHandler],
        // ["/doorbell", EmbassyHandlers.doorbellHandler],
        // ["/webcam", EmbassyHandlers.webcamHandler],
        // ["/webcam2", EmbassyHandlers.webcam2Handler],
        // ["/doorcam", EmbassyHandlers.doorcamHandler],
        // ["/uanettestatus", EmbassyHandlers.printerStatusHandler],
        // ["/anettestatus", EmbassyHandlers.printerStatusHandler],
        // ["/uplumbusstatus", EmbassyHandlers.printerStatusHandler],
        // ["/plumbusstatus", EmbassyHandlers.printerStatusHandler],
        // ["/uconditioner", EmbassyHandlers.conditionerHandler],
        // ["/turnconditioneron", EmbassyHandlers.turnConditionerHandler],
        // ["/turnconditioneroff", EmbassyHandlers.turnConditionerHandler],
        // ["/addconditionertemp", EmbassyHandlers.turnConditionerHandler],
        // ["/setconditionermode", EmbassyHandlers.turnConditionerHandler],
        // ["/bought", ServiceHandlers.boughtButtonHandler],
        // ["/bought_undo", NeedsHandlers.boughtUndoHandler],
        // ["/moan", EmbassyHandlers.playinspaceHandler],
        // ["/fart", EmbassyHandlers.playinspaceHandler],
        // ["/adler", EmbassyHandlers.playinspaceHandler],
        // ["/rickroll", EmbassyHandlers.playinspaceHandler],
        // ["/rzd", EmbassyHandlers.playinspaceHandler],
        // ["/rfoxed", EmbassyHandlers.playinspaceHandler],
        // ["/zhuchok", EmbassyHandlers.playinspaceHandler],
        // ["/nani", EmbassyHandlers.playinspaceHandler],
        // ["/sad", EmbassyHandlers.playinspaceHandler],
        // ["/badumtss", EmbassyHandlers.playinspaceHandler],
        // ["/dushno", EmbassyHandlers.playinspaceHandler],
    ]);

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
        const data = callbackQuery.data ? (JSON.parse(callbackQuery.data) as CallbackData) : undefined;

        if (!data) throw Error("Missing calback query data");

        msg.from = callbackQuery.from;
        const isAllowed = bot.canUserCall.bind(bot, msg.from.username);

        if (data.vId && callbackQuery.from.id === data.vId) {
            return ServiceHandlers.handleUserVerification(bot, data.vId, msg);
        }

        const handler = this.routeMap.get(data.command!) as AnyFunction;
        const params: any[] = ServiceHandlers.getParams(bot, msg, data, callbackQuery);

        if (data.flags !== undefined) {
            if (data.flags & Flags.Silent) bot.context(msg).mode.silent = true;
            if (data.flags & Flags.Editing) bot.context(msg).isEditing = true;
            if (data.flags & Flags.Restricted && !isAllowed(handler)) return;
        }

        await handler.apply(params);
    }

    private static getParams(
        bot: HackerEmbassyBot,
        msg: TelegramBot.Message,
        data: CallbackData,
        callbackQuery: TelegramBot.CallbackQuery
    ) {
        const params: any[] = [bot, msg];

        switch (data.command) {
            case "/ef":
                params.push(data.fn!);
                break;
            case "/ed":
                params.push(data.fn!);
                break;
            case "/bought":
                params.push(callbackQuery.data!);
                break;
            case "/s_ustatus":
                bot.context(msg).mode.pin = true;
                break;
            case "/webcam":
                bot.context(msg).isEditing = data.edit ?? false;
                break;
            case "/webcam2":
                bot.context(msg).isEditing = data.edit ?? false;
                break;
            case "/doorcam":
                bot.context(msg).isEditing = data.edit ?? false;
                break;
            case "/uanettestatus":
                params.push("anette");
                break;
            case "/anettestatus":
                params.push("anette");
                break;
            case "/uplumbusstatus":
                params.push("plumbus");
                break;
            case "/plumbusstatus":
                params.push("plumbus");
                break;
            case "/turnconditioneron":
                params.push(async () => {
                    await EmbassyHandlers.turnConditionerHandler(bot, msg, true);
                });
                break;
            case "/turnconditioneroff":
                params.push(async () => {
                    await EmbassyHandlers.turnConditionerHandler(bot, msg, false);
                });
                break;
            case "/addconditionertemp":
                params.push(async () => {
                    await EmbassyHandlers.addConditionerTempHandler(bot, msg, data.diff!);
                });
                break;
            case "/setconditionermode":
                params.push(async () => {
                    await EmbassyHandlers.setConditionerModeHandler(bot, msg, data.mode!);
                });
                break;
            case "/moan":
            case "/fart":
            case "/adler":
            case "/rickroll":
            case "/rzd":
            case "/rfoxed":
            case "/zhuchok":
            case "/nani":
            case "/sad":
            case "/badumtss":
            case "/dushno":
                params.push(`${embassyBase}${data.command}.mp3`);
                break;
            default:
                break;
        }

        return params;
    }

    private static async handleUserVerification(bot: HackerEmbassyBot, vId: number, msg: TelegramBot.Message) {
        const tgUser = (await bot.getChat(vId)) as ITelegramUser;

        if (this.verifyAndAddUser(tgUser)) {
            try {
                botConfig.moderatedChats.forEach(chatId =>
                    bot.restrictChatMember(chatId, tgUser.id as number, FULL_PERMISSIONS).catch(error => logger.error(error))
                );

                await bot.deleteMessage(msg.chat.id, msg.message_id);
                await this.welcomeHandler(bot, msg.chat, tgUser);
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

    static async boughtButtonHandler(bot: HackerEmbassyBot, message: Message, id: number, data: string): Promise<void> {
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
