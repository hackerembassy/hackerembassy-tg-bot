const TextGenerators = require("../../services/textGenerators");
const UsersHelper = require("../../services/usersHelper");
const Commands = require("../../resources/commands");
const CoinsHelper = require("../../resources/coins/coins");

const UsersRepository = require("../../repositories/usersRepository");
const botConfig = require("config").get("bot");
const t = require("../../services/localization");
const { isMessageFromPrivateChat } = require("../bot-helpers");

/**
 * @typedef {import("../HackerEmbassyBot").HackerEmbassyBot} HackerEmbassyBot
 * @typedef {import("node-telegram-bot-api").Message} Message
 */

class BasicHandlers {
    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async helpHandler(bot, msg) {
        const text = t("basic.help", {
            availableCommands: UsersHelper.getAvailableCommands(msg.from.username),
            globalModifiers: Commands.GlobalModifiers,
        });

        await bot.sendLongMessage(msg.chat.id, text, msg);
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async aboutHandler(bot, msg) {
        await bot.sendMessageExt(msg.chat.id, t("basic.about"), msg);
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async joinHandler(bot, msg) {
        let message = TextGenerators.getJoinText();
        await bot.sendMessageExt(msg.chat.id, message, msg);
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async eventsHandler(bot, msg) {
        const message = TextGenerators.getEventsText(false, botConfig.calendarAppLink);

        await bot.sendMessageExt(msg.chat.id, message, msg, {
            reply_markup: {
                inline_keyboard: isMessageFromPrivateChat(msg)
                    ? [
                          [
                              {
                                  text: t("basic.events.opencalendar"),
                                  web_app: {
                                      url: botConfig.calendarUrl,
                                  },
                              },
                          ],
                      ]
                    : undefined,
            },
        });
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async issueHandler(bot, msg, issueText) {
        const helpMessage = t("basic.issue.help");
        const sentMessage = t("basic.issue.sent");
        const report = t("basic.issue.report", { issue: issueText });
        if (issueText !== undefined) {
            await bot.sendMessageExt(msg.chat.id, sentMessage, msg);
            await bot.sendMessageExt(botConfig.chats.key, report, msg);
        } else {
            await bot.sendMessageExt(msg.chat.id, helpMessage, msg);
        }
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async donateHandler(bot, msg) {
        const accountants = UsersRepository.getUsersByRole("accountant");
        const message = TextGenerators.getDonateText(accountants);
        await bot.sendMessageExt(msg.chat.id, message, msg);
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async locationHandler(bot, msg) {
        await bot.sendMessageExt(msg.chat.id, t("basic.location.address"), msg);
        await bot.sendLocationExt(msg.chat.id, 40.18258, 44.51338, msg);
        await bot.sendPhotoExt(msg.chat.id, "./resources/images/house.jpg", msg, { caption: t("basic.location.caption") });
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async donateCoinHandler(bot, msg, coinname) {
        coinname = coinname.toLowerCase();
        const qrImage = await CoinsHelper.getQR(coinname);
        const coin = CoinsHelper.getCoinDefinition(coinname);

        await bot.sendPhotoExt(msg.chat.id, qrImage, msg, {
            parse_mode: "Markdown",
            caption: t("basic.donateCoin", { coin }),
        });
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async donateCardHandler(bot, msg) {
        const accountantsList = TextGenerators.getAccountsList(
            UsersRepository.getUsersByRole("accountant"),
            bot.context(msg).mode
        );

        await bot.sendMessageExt(msg.chat.id, t("basic.donateCard", { accountantsList }), msg);
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async getResidentsHandler(bot, msg) {
        const users = UsersRepository.getUsers().filter(u => UsersHelper.hasRole(u.username, "member"));
        const message = TextGenerators.getResidentsList(users, bot.context(msg).mode);

        await bot.sendLongMessage(msg.chat.id, message, msg);
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async startPanelHandler(bot, msg) {
        const inlineKeyboard = [
            [
                {
                    text: t("basic.start.buttons.status"),
                    callback_data: JSON.stringify({ command: "/status" }),
                },
            ],
            [
                {
                    text: t("basic.start.buttons.events"),
                    callback_data: JSON.stringify({ command: "/events" }),
                },
                {
                    text: t("basic.start.buttons.funds"),
                    callback_data: JSON.stringify({ command: "/funds" }),
                },
            ],
            [
                {
                    text: t("basic.start.buttons.control"),
                    callback_data: JSON.stringify({ command: "/controlpanel" }),
                },
                {
                    text: t("basic.start.buttons.info"),
                    callback_data: JSON.stringify({ command: "/infopanel" }),
                },
            ],
            [
                {
                    text: t("basic.start.buttons.birthdays"),
                    callback_data: JSON.stringify({ command: "/birthdays" }),
                },
                {
                    text: t("basic.start.buttons.needs"),
                    callback_data: JSON.stringify({ command: "/needs" }),
                },
            ],
            [
                {
                    text: t("basic.start.buttons.printers"),
                    callback_data: JSON.stringify({ command: "/printers" }),
                },
                {
                    text: t("basic.start.buttons.help"),
                    callback_data: JSON.stringify({ command: "/help" }),
                },
            ],
        ];

        await bot.sendOrEditMessage(
            msg.chat.id,
            t("basic.start.text"),
            msg,
            {
                reply_markup: {
                    inline_keyboard: inlineKeyboard,
                },
            },
            msg.message_id
        );
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async controlPanelHandler(bot, msg) {
        const inlineKeyboard = [
            [
                {
                    text: t("basic.control.buttons.unlock"),
                    callback_data: JSON.stringify({ command: "/unlock" }),
                },
                {
                    text: t("basic.control.buttons.doorbell"),
                    callback_data: JSON.stringify({ command: "/doorbell" }),
                },
            ],
            [
                {
                    text: t("basic.control.buttons.webcam"),
                    callback_data: JSON.stringify({ command: "/webcam" }),
                },
                {
                    text: t("basic.control.buttons.webcam2"),
                    callback_data: JSON.stringify({ command: "/webcam2" }),
                },
                {
                    text: t("basic.control.buttons.doorcam"),
                    callback_data: JSON.stringify({ command: "/doorcam" }),
                },
            ],
            [
                {
                    text: t("basic.control.buttons.superstatus"),
                    callback_data: JSON.stringify({ command: "/superstatus" }),
                },
            ],
            [
                {
                    text: t("basic.control.buttons.back"),
                    callback_data: JSON.stringify({ command: "/startpanel" }),
                },
            ],
        ];

        await bot.sendOrEditMessage(
            msg.chat.id,
            t("basic.control.text"),
            msg,
            {
                reply_markup: {
                    inline_keyboard: inlineKeyboard,
                },
            },
            msg.message_id
        );
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async infoPanelHandler(bot, msg) {
        const inlineKeyboard = [
            [
                {
                    text: t("basic.info.buttons.about"),
                    callback_data: JSON.stringify({ command: "/about" }),
                },
                {
                    text: t("basic.info.buttons.join"),
                    callback_data: JSON.stringify({ command: "/join" }),
                },
            ],
            [
                {
                    text: t("basic.info.buttons.location"),
                    callback_data: JSON.stringify({ command: "/location" }),
                },
                {
                    text: t("basic.info.buttons.donate"),
                    callback_data: JSON.stringify({ command: "/donate" }),
                },
            ],
            [
                {
                    text: t("basic.info.buttons.residents"),
                    callback_data: JSON.stringify({ command: "/getresidents" }),
                },
                {
                    text: t("basic.info.buttons.back"),
                    callback_data: JSON.stringify({ command: "/startpanel" }),
                },
            ],
        ];

        await bot.sendOrEditMessage(
            msg.chat.id,
            t("basic.info.text"),
            msg,
            {
                reply_markup: {
                    inline_keyboard: inlineKeyboard,
                },
            },
            msg.message_id
        );
    }
}

module.exports = BasicHandlers;
