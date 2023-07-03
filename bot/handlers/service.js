const UsersHelper = require("../../services/usersHelper");

const StatusHandlers = require("./status");
const FundsHandlers = require("./funds");
const NeedsHandlers = require("./needs");
const BirthdayHandlers = require("./birthday");
const BasicHandlers = require("./basic");
const EmbassyHandlers = require("./embassy");

const botConfig = require("config").get("bot");

const t = require("../../services/localization");
const { logger } = require("../../repositories/statusRepository");

class ServiceHandlers {
    static clearHandler = async (bot, msg, count) => {
        if (!UsersHelper.hasRole(msg.from.username, "member")) return;

        let inputCount = Number(count);
        let countToClear = inputCount > 0 ? inputCount : 1;
        let messagesToRemove = bot.messageHistory.pop(msg.chat.id, countToClear, msg.reply_to_message?.message_id);

        for await (const message of messagesToRemove) {
            await bot.deleteMessage(msg.chat.id, message.messageId).catch(() => false);
        }
    };

    static combineHandler = async (bot, msg, count) => {
        if (!UsersHelper.hasRole(msg.from.username, "member")) return;

        const inputCount = Number(count);
        const countToCombine = inputCount > 2 ? inputCount : 2;
        const messagesToCombine = bot.messageHistory.pop(msg.chat.id, countToCombine, msg.reply_to_message?.message_id);
        const messages = [];

        for await (const message of messagesToCombine) {
            let success = await bot.deleteMessage(msg.chat.id, message.messageId).catch(() => false);
            // TODO combining images into one message
            if (success)
                messages.push(
                    `[${new Date(message.datetime).toLocaleString("RU-ru").substring(0, 17)}]: ${message.text ?? "photo"}`
                );
        }

        messages.reverse();
        const combinedMessageText = messages.join("\n");

        if (combinedMessageText.length > 0) await bot.sendMessage(msg.chat.id, combinedMessageText);
    };

    static chatidHandler = (bot, msg) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin")) return;
        bot.sendMessage(msg.chat.id, `${msg.chat.id} ${msg.message_thread_id}`);
    };

    static superstatusHandler = async (bot, msg) => {
        if (!UsersHelper.hasRole(msg.from.username, "member", "admin")) return;

        await StatusHandlers.statusHandler(bot, msg);
        await EmbassyHandlers.webcamHandler(bot, msg);
        await EmbassyHandlers.webcam2Handler(bot, msg);
        await EmbassyHandlers.doorcamHandler(bot, msg);
    };

    static callbackHandler = async (bot, callbackQuery) => {
        try {
            const message = callbackQuery.message;
            const data = JSON.parse(callbackQuery.data);
            message.from = callbackQuery.from;
            bot.context.messageThreadId = message.message_thread_id;

            switch (data.command) {
                case "/in":
                    await StatusHandlers.inHandler(bot, message);
                    break;
                case "/out":
                    await StatusHandlers.outHandler(bot, message);
                    break;
                case "/going":
                    await StatusHandlers.goingHandler(bot, message);
                    break;
                case "/notgoing":
                    await StatusHandlers.notGoingHandler(bot, message);
                    break;
                case "/open":
                    await StatusHandlers.openHandler(bot, message);
                    break;
                case "/close":
                    await StatusHandlers.closeHandler(bot, message);
                    break;
                case "/status":
                    await StatusHandlers.statusHandler(bot, message);
                    break;
                case "/ustatus":
                    await StatusHandlers.statusHandler(bot, message, true);
                    break;
                case "/superstatus":
                    await this.superstatusHandler(bot, message);
                    break;
                case "/birthdays":
                    await BirthdayHandlers.birthdayHandler(bot, message);
                    break;
                case "/needs":
                    await NeedsHandlers.needsHandler(bot, message);
                    break;
                case "/funds":
                    await FundsHandlers.fundsHandler(bot, message);
                    break;
                case "/startpanel":
                    await BasicHandlers.startPanelHandler(bot, message, true);
                    break;
                case "/infopanel":
                    await BasicHandlers.infoPanelHandler(bot, message, true);
                    break;
                case "/controlpanel":
                    await BasicHandlers.controlPanelHandler(bot, message, true);
                    break;
                case "/about":
                    await BasicHandlers.aboutHandler(bot, message);
                    break;
                case "/help":
                    await BasicHandlers.helpHandler(bot, message);
                    break;
                case "/donate":
                    await BasicHandlers.donateHandler(bot, message);
                    break;
                case "/join":
                    await BasicHandlers.joinHandler(bot, message);
                    break;
                case "/events":
                    await BasicHandlers.eventsHandler(bot, message);
                    break;
                case "/location":
                    await BasicHandlers.locationHandler(bot, message);
                    break;
                case "/getresidents":
                    await BasicHandlers.getResidentsHandler(bot, message);
                    break;
                case "/ef":
                    await FundsHandlers.exportCSVHandler(bot, message, ...data.params);
                    break;
                case "/ed":
                    await FundsHandlers.exportDonutHandler(bot, message, ...data.params);
                    break;
                case "/unlock":
                    await EmbassyHandlers.unlockHandler(bot, message);
                    break;
                case "/doorbell":
                    await EmbassyHandlers.doorbellHandler(bot, message);
                    break;
                case "/webcam":
                    await EmbassyHandlers.webcamHandler(bot, message);
                    break;
                case "/webcam2":
                    await EmbassyHandlers.webcam2Handler(bot, message);
                    break;
                case "/doorcam":
                    await EmbassyHandlers.doorcamHandler(bot, message);
                    break;
                case "/printers":
                    await EmbassyHandlers.printersHandler(bot, message);
                    break;
                case "/printerstatus anette":
                case "/anettestatus":
                    await EmbassyHandlers.printerStatusHandler(bot, message, "anette");
                    break;
                case "/printerstatus plumbus":
                case "/plumbusstatus":
                    await EmbassyHandlers.printerStatusHandler(bot, message, "plumbus");
                    break;
                case "/bought":
                    this.boughtButtonHandler(bot, message, data.id, callbackQuery);
                    break;
                case "/bought_undo":
                    if (NeedsHandlers.boughtUndoHandler(bot, message, data.id)) {
                        await bot.deleteMessage(message.chat.id, message.message_id);
                    }
                    break;
                default:
                    break;
            }

            await bot.answerCallbackQuery(callbackQuery.id);
        } catch (error) {
            logger.log(error);
        } finally {
            bot.context.clear();
        }
    };

    static newMemberHandler = async (bot, msg) => {
        const botName = (await bot.getMe()).username;
        const newMembers = msg.new_chat_members.reduce(
            (res, member) =>
                res + `${member?.username ? UsersHelper.formatUsername(member.username, bot.context.mode) : member?.first_name} `,
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

        bot.sendMessage(msg.chat.id, welcomeText);
    };

    static boughtButtonHandler = (bot, message, id, callbackQuery) => {
        NeedsHandlers.boughtByIdHandler(bot, message, id);

        const new_keyboard = message.reply_markup.inline_keyboard.filter(
            button => button[0].callback_data !== callbackQuery.data
        );

        if (new_keyboard.length != message.reply_markup.inline_keyboard.length) {
            bot.editMessageReplyMarkup(
                { inline_keyboard: new_keyboard },
                {
                    chat_id: message.chat.id,
                    message_id: message.message_id,
                }
            );
        }
    };
}

module.exports = ServiceHandlers;
