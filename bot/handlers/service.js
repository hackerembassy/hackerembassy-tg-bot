const UsersHelper = require("../../services/usersHelper");
const UsersRepository = require("../../repositories/usersRepository");

const StatusHandlers = require("./status");
const FundsHandlers = require("./funds");
const NeedsHandlers = require("./needs");
const BirthdayHandlers = require("./birthday");
const BasicHandlers = require("./basic");
const EmbassyHandlers = require("./embassy");

const botConfig = require("config").get("bot");

const t = require("../../services/localization");
const { logger } = require("../../repositories/statusRepository");
const { setMenu } = require("../bot-menu");
const RateLimiter = require("../../services/RateLimiter");

class ServiceHandlers {
    static clearHandler = async (bot, msg, count) => {
        if (!UsersHelper.hasRole(msg.from.username, "member")) return;

        const inputCount = Number(count);
        const countToClear = inputCount > 0 ? inputCount : 1;
        let orderOfLastMessage = msg.reply_to_message?.message_id
            ? bot.messageHistory.orderOf(msg.chat.id, msg.reply_to_message.message_id)
            : 0;

        let messagesRemained = countToClear;
        while (messagesRemained > 0) {
            const message = await bot.messageHistory.pop(msg.chat.id, orderOfLastMessage);
            if (!message) return;

            const success = await bot.deleteMessage(msg.chat.id, message.messageId).catch(() => false);
            if (success) messagesRemained--;
        }
    };

    static combineHandler = async (bot, msg, count) => {
        if (!UsersHelper.hasRole(msg.from.username, "member")) return;

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
                .editMessageText("combining...", {
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
            await bot.editMessageText(combinedMessageText, {
                chat_id: msg.chat.id,
                message_id: lastMessageToEdit.messageId,
            });
        }
    };

    static chatidHandler = (bot, msg) => {
        if (!UsersHelper.hasRole(msg.from.username, "admin")) return;
        bot.sendMessage(msg.chat.id, `chatId: ${msg.chat.id}, topicId: ${msg.message_thread_id}`);
    };

    static residentMenuHandler = (bot, msg) => {
        if (!UsersHelper.hasRole(msg.from.username, "member")) return;

        UsersRepository.setUserid(msg.from.username ?? msg.from.first_name, msg.from.id);

        setMenu(bot);

        bot.sendMessage(
            msg.chat.id,
            `Resident menu is enabled for ${msg.from.username}[userid:${msg.from.id}] in the private chat`
        );
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
            bot.context.messageThreadId = callbackQuery.message.message_thread_id;
            RateLimiter.throttle(this.routeQuery, [bot, callbackQuery], callbackQuery.message.from.id, this);
        } catch (error) {
            logger.log(error);
        } finally {
            bot.context.clear();
        }
    };

    static routeQuery = async function (bot, callbackQuery) {
        const data = JSON.parse(callbackQuery.data);
        const message = callbackQuery.message;

        message.from = callbackQuery.from;

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
                await this.boughtButtonHandler(bot, message, data.id, data);
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

    static boughtButtonHandler = async (bot, message, id, data) => {
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
    };
}

module.exports = ServiceHandlers;
