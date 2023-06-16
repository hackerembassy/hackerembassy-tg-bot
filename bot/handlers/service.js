const UsersHelper = require("../../services/usersHelper");

const StatusHandlers = require("./status");
const FundsHandlers = require("./funds");
const NeedsHandlers = require("./needs");
const BirthdayHandlers = require("./birthday");
const BasicHandlers = require("./basic");
const EmbassyHandlers = require("./embassy");

class ServiceHandlers {
    static clearHandler = (bot, msg, count) => {
        if (!UsersHelper.hasRole(msg.from.username, "member")) return;

        let inputCount = Number(count);
        let countToClear = inputCount > 0 ? inputCount : 1;
        let idsToRemove = bot.popLast(msg.chat.id, countToClear);

        for (const id of idsToRemove) {
            bot.deleteMessage(msg.chat.id, id);
        }
    };

    static superstatusHandler = async (bot, msg) => {
        if (!UsersHelper.hasRole(msg.from.username, "member", "admin")) return;

        await StatusHandlers.statusHandler(bot, msg);
        await EmbassyHandlers.webcamHandler(bot, msg);
        await EmbassyHandlers.webcam2Handler(bot, msg);
        await EmbassyHandlers.doorcamHandler(bot, msg);
    };

    static callbackHandler = (bot, callbackQuery) => {
        const message = callbackQuery.message;
        const data = JSON.parse(callbackQuery.data);
        message.from = callbackQuery.from;

        switch (data.command) {
            case "/in":
                StatusHandlers.inHandler(bot, message);
                break;
            case "/out":
                StatusHandlers.outHandler(bot, message);
                break;
            case "/going":
                StatusHandlers.goingHandler(bot, message);
                break;
            case "/notgoing":
                StatusHandlers.notGoingHandler(bot, message);
                break;
            case "/open":
                StatusHandlers.openHandler(bot, message);
                break;
            case "/close":
                StatusHandlers.closeHandler(bot, message);
                break;
            case "/status":
                StatusHandlers.statusHandler(bot, message);
                break;
            case "/ustatus":
                StatusHandlers.statusHandler(bot, message, true);
                break;
            case "/superstatus":
                this.superstatusHandler(bot, message);
                break;
            case "/birthdays":
                BirthdayHandlers.birthdayHandler(bot, message);
                break;
            case "/needs":
                NeedsHandlers.needsHandler(bot, message);
                break;
            case "/funds":
                FundsHandlers.fundsHandler(bot, message);
                break;
            case "/startpanel":
                BasicHandlers.startPanelHandler(bot, message, true);
                break;
            case "/infopanel":
                BasicHandlers.infoPanelHandler(bot, message, true);
                break;
            case "/controlpanel":
                BasicHandlers.controlPanelHandler(bot, message, true);
                break;
            case "/about":
                BasicHandlers.aboutHandler(bot, message);
                break;
            case "/help":
                BasicHandlers.helpHandler(bot, message);
                break;
            case "/donate":
                BasicHandlers.donateHandler(bot, message);
                break;
            case "/join":
                BasicHandlers.joinHandler(bot, message);
                break;
            case "/events":
                BasicHandlers.eventsHandler(bot, message);
                break;
            case "/location":
                BasicHandlers.locationHandler(bot, message);
                break;
            case "/getresidents":
                BasicHandlers.getResidentsHandler(bot, message);
                break;
            case "/ef":
                FundsHandlers.exportCSVHandler(bot, message, ...data.params);
                break;
            case "/ed":
                FundsHandlers.exportDonutHandler(bot, message, ...data.params);
                break;
            case "/unlock":
                EmbassyHandlers.unlockHandler(bot, message);
                break;
            case "/doorbell":
                EmbassyHandlers.doorbellHandler(bot, message);
                break;
            case "/webcam":
                EmbassyHandlers.webcamHandler(bot, message);
                break;
            case "/webcam2":
                EmbassyHandlers.webcam2Handler(bot, message);
                break;
            case "/doorcam":
                EmbassyHandlers.doorcamHandler(bot, message);
                break;
            case "/printers":
                EmbassyHandlers.printersHandler(bot, message);
                break;
            case "/printerstatus anette":
            case "/anettestatus":
                EmbassyHandlers.printerStatusHandler(bot, message, "anette");
                break;
            case "/printerstatus plumbus":
            case "/plumbusstatus":
                EmbassyHandlers.printerStatusHandler(bot, message, "plumbus");
                break;
            case "/bought":
                this.boughtButtonHandler(bot, message, data.id, callbackQuery);
                break;
            case "/bought_undo":
                if (NeedsHandlers.boughtUndoHandler(bot, message, data.id)) {
                    bot.deleteMessage(message.chat.id, message.message_id);
                }
                break;
            default:
                break;
        }

        bot.answerCallbackQuery(callbackQuery.id);
    };

    static newMemberHandler = async (bot, msg) => {
        let botName = (await bot.getMe()).username;
        let newMembers = msg.new_chat_members.reduce(
            (res, member) =>
                res + `${member?.username ? UsersHelper.formatUsername(member.username, bot.mode) : member?.first_name} `,
            ""
        );
        let message = `🇬🇧 Добро пожаловать в наш уютный уголок, ${newMembers}
      
Я @${botName}, бот-менеджер хакерспейса. Ко мне в личку можно зайти пообщаться, чтобы я вкратце о нас рассказал.
Не забудь также зайти в наш второй чатик @hackem_foo! Там ты найдешь разные топики по основным проектам спейса, обсуждения будущих мероприятий, новостей, мемов и так далее.

🎉🎉🎉 Хакерчане, приветствуем ${newMembers}`;
        bot.sendMessage(msg.chat.id, message);
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
