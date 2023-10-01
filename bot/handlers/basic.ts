import config from "config";
import { Message } from "node-telegram-bot-api";

import { BotConfig } from "../../config/schema";
import UsersRepository from "../../repositories/usersRepository";
import * as Commands from "../../resources/commands";
import { getNClosestEventsFromCalendar } from "../../services/googleCalendar";
import t from "../../services/localization";
import logger from "../../services/logger";
import * as TextGenerators from "../../services/textGenerators";
import * as UsersHelper from "../../services/usersHelper";
import * as CoinsHelper from "../../utils/coins";
import { isPrivateMessage } from "../bot-helpers";
import HackerEmbassyBot from "../HackerEmbassyBot";

const botConfig = config.get<BotConfig>("bot");

export default class BasicHandlers {
    static async helpHandler(bot: HackerEmbassyBot, msg: Message) {
        const text = t("basic.help", {
            availableCommands: UsersHelper.getAvailableCommands(msg.from?.username),
            globalModifiers: Commands.GlobalModifiers,
        });

        await bot.sendLongMessage(msg.chat.id, text, msg);
    }

    static async aboutHandler(bot: HackerEmbassyBot, msg: Message) {
        await bot.sendMessageExt(msg.chat.id, t("basic.about"), msg);
    }

    static async joinHandler(bot: HackerEmbassyBot, msg: Message) {
        const message = TextGenerators.getJoinText();
        await bot.sendMessageExt(msg.chat.id, message, msg);
    }

    static async eventsHandler(bot: HackerEmbassyBot, msg: Message) {
        const message = TextGenerators.getEventsText(false, botConfig.calendar.appLink);

        await bot.sendMessageExt(msg.chat.id, message, msg, {
            reply_markup: {
                inline_keyboard: isPrivateMessage(msg, bot.context(msg))
                    ? [
                          [
                              {
                                  text: t("basic.events.opencalendar"),
                                  web_app: {
                                      url: botConfig.calendar.appLink,
                                  },
                              },
                          ],
                      ]
                    : [],
            },
        });
    }

    static async issueHandler(bot: HackerEmbassyBot, msg: Message, issueText: string) {
        const helpMessage = t("basic.issue.help");
        const sentMessage = t("basic.issue.sent");
        const report = t("basic.issue.report", { issue: issueText });
        if (issueText) {
            await bot.sendMessageExt(msg.chat.id, sentMessage, msg);
            await bot.sendMessageExt(botConfig.chats.key, report, msg);
        } else {
            await bot.sendMessageExt(msg.chat.id, helpMessage, msg);
        }
    }

    static async donateHandler(bot: HackerEmbassyBot, msg: Message) {
        const accountants = UsersRepository.getUsersByRole("accountant");
        const message = TextGenerators.getDonateText(accountants);
        await bot.sendMessageExt(msg.chat.id, message, msg);
    }

    static async locationHandler(bot: HackerEmbassyBot, msg: Message) {
        await bot.sendMessageExt(msg.chat.id, t("basic.location.address"), msg);
        await bot.sendLocationExt(msg.chat.id, 40.18258, 44.51338, msg);
        await bot.sendPhotoExt(msg.chat.id, "./resources/images/house.jpg", msg, { caption: t("basic.location.caption") });
    }

    static async donateCoinHandler(bot: HackerEmbassyBot, msg: Message, coinname: string) {
        const coinDefinition = CoinsHelper.getCoinDefinition(coinname.toLowerCase());

        if (!coinDefinition) {
            await bot.sendMessageExt(msg.chat.id, t("basic.donateCoin.invalidCoin"), msg);
            return;
        }

        const qrImage = await CoinsHelper.getQR(coinDefinition);

        await bot.sendPhotoExt(msg.chat.id, qrImage, msg, {
            parse_mode: "Markdown",
            caption: t("basic.donateCoin", { coin: coinDefinition }),
        });
    }

    static async donateCardHandler(bot: HackerEmbassyBot, msg: Message) {
        const accountantsList = TextGenerators.getAccountsList(
            UsersRepository.getUsersByRole("accountant"),
            bot.context(msg).mode
        );

        await bot.sendMessageExt(msg.chat.id, t("basic.donateCard", { accountantsList }), msg);
    }

    static async getResidentsHandler(bot: HackerEmbassyBot, msg: Message) {
        const users = UsersRepository.getUsers()?.filter(u => UsersHelper.hasRole(u.username, "member"));
        const message = TextGenerators.getResidentsList(users, bot.context(msg).mode);

        await bot.sendLongMessage(msg.chat.id, message, msg);
    }

    static async startPanelHandler(bot: HackerEmbassyBot, msg: Message) {
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

    static async controlPanelHandler(bot: HackerEmbassyBot, msg: Message) {
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
                    text: t("basic.control.buttons.conditioner"),
                    callback_data: JSON.stringify({ command: "/conditioner" }),
                },
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

    static async infoPanelHandler(bot: HackerEmbassyBot, msg: Message) {
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

    static async getEventsHandler(bot: HackerEmbassyBot, msg: Message) {
        let messageText: string = t("basic.events.upcoming") + "\n";

        try {
            const events = await getNClosestEventsFromCalendar(botConfig.calendar.upcomingToLoad);

            if (!events || events.length === 0) throw new Error();

            for (const event of events) {
                messageText += TextGenerators.HSEventToString(event);
                messageText += "\n\n";
            }
        } catch (error) {
            messageText = t("basic.events.error");
            logger.error(error);
        } finally {
            bot.sendMessageExt(msg.chat.id, messageText, msg);
        }
    }
}
