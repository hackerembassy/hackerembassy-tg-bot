const TextGenerators = require("../../services/textGenerators");
const UsersHelper = require("../../services/usersHelper");
const Commands = require("../../resources/commands");
const CoinsHelper = require("../../resources/coins/coins");

const UsersRepository = require("../../repositories/usersRepository");
const botConfig = require("config").get("bot");
const t = require("../../services/localization");
const { isMessageFromPrivateChat } = require("../bot-helpers");

class BasicHandlers {
    static helpHandler = async (bot, msg) => {
        const text = t("basic.help", {
            availableCommands: UsersHelper.getAvailableCommands(msg.from.username),
            globalModifiers: Commands.GlobalModifiers,
        });

        await bot.sendLongMessage(msg.chat.id, text);
    };

    static aboutHandler = async (bot, msg) => {
        await bot.sendMessage(msg.chat.id, t("basic.about"));
    };

    static joinHandler = async (bot, msg) => {
        let message = TextGenerators.getJoinText();
        await bot.sendMessage(msg.chat.id, message);
    };

    static eventsHandler = async (bot, msg) => {
        const message = TextGenerators.getEventsText(false, botConfig.calendarAppLink);

        await bot.sendMessage(msg.chat.id, message, {
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
    };

    static issueHandler = async (bot, msg, issueText) => {
        const helpMessage = t("basic.issue.help");
        const sentMessage = t("basic.issue.sent");
        const report = t("basic.issue.report", { issue: issueText });
        if (issueText !== undefined) {
            await bot.sendMessage(msg.chat.id, sentMessage);
            await bot.sendMessage(botConfig.chats.key, report);
        } else {
            await bot.sendMessage(msg.chat.id, helpMessage);
        }
    };

    static donateHandler = async (bot, msg) => {
        const accountants = UsersRepository.getUsersByRole("accountant");
        const message = TextGenerators.getDonateText(accountants);
        await bot.sendMessage(msg.chat.id, message);
    };

    static locationHandler = async (bot, msg) => {
        await bot.sendMessage(msg.chat.id, t("basic.location.address"));
        await bot.sendLocation(msg.chat.id, 40.18258, 44.51338);
        await bot.sendPhoto(msg.chat.id, "./resources/images/house.jpg", { caption: t("basic.location.caption") });
    };

    static donateCoinHandler = async (bot, msg, coinname) => {
        coinname = coinname.toLowerCase();
        const qrImage = await CoinsHelper.getQR(coinname);
        const coin = CoinsHelper.getCoinDefinition(coinname);

        await bot.sendPhoto(msg.chat.id, qrImage, {
            parse_mode: "Markdown",
            caption: t("basic.donateCoin", { coin }),
        });
    };

    static donateCardHandler = async (bot, msg) => {
        const accountantsList = TextGenerators.getAccountsList(UsersRepository.getUsersByRole("accountant"), bot.context.mode);

        await bot.sendMessage(msg.chat.id, t("basic.donateCard", { accountantsList }));
    };

    static getResidentsHandler = async (bot, msg) => {
        const users = UsersRepository.getUsers().filter(u => UsersHelper.hasRole(u.username, "member"));
        const message = TextGenerators.getResidentsList(users, bot.context.mode);

        await bot.sendLongMessage(msg.chat.id, message);
    };

    static startPanelHandler = async (bot, msg) => {
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
            {
                reply_markup: {
                    inline_keyboard: inlineKeyboard,
                },
            },
            msg.message_id
        );
    };

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
            {
                reply_markup: {
                    inline_keyboard: inlineKeyboard,
                },
            },
            msg.message_id
        );
    }

    static infoPanelHandler = async (bot, msg) => {
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
            {
                reply_markup: {
                    inline_keyboard: inlineKeyboard,
                },
            },
            msg.message_id
        );
    };
}

module.exports = BasicHandlers;
