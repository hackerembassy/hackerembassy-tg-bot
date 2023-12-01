import config from "config";
import { Message } from "node-telegram-bot-api";

import { BotConfig } from "../../config/schema";
import UsersRepository from "../../repositories/usersRepository";
import * as Commands from "../../resources/commands";
import { getClosestEventsFromCalendar, getTodayEvents } from "../../services/googleCalendar";
import t from "../../services/localization";
import logger from "../../services/logger";
import * as TextGenerators from "../../services/textGenerators";
import { getEventsList } from "../../services/textGenerators";
import * as CoinsHelper from "../../utils/coins";
import HackerEmbassyBot from "../core/HackerEmbassyBot";
import { BotHandlers } from "../core/types";
import * as helpers from "../helpers";
import { InlineButton, isPrivateMessage } from "../helpers";
import { Flags } from "./service";

const botConfig = config.get<BotConfig>("bot");

export default class BasicHandlers implements BotHandlers {
    static async helpHandler(bot: HackerEmbassyBot, msg: Message) {
        const text = t("basic.help", {
            availableCommands: helpers.getAvailableCommands(msg.from?.username),
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
                                      url: botConfig.calendar.url,
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
        const users = UsersRepository.getUsers()?.filter(u => helpers.hasRole(u.username, "member"));
        const message = TextGenerators.getResidentsList(users, bot.context(msg).mode);

        await bot.sendLongMessage(msg.chat.id, message, msg);
    }

    static async startPanelHandler(bot: HackerEmbassyBot, msg: Message) {
        const inline_keyboard = [
            [InlineButton(t("basic.start.buttons.status"), "status")],
            [InlineButton(t("basic.start.buttons.events"), "events"), InlineButton(t("basic.start.buttons.funds"), "funds")],
            [
                InlineButton(t("basic.start.buttons.control"), "controlpanel", Flags.Editing),
                InlineButton(t("basic.start.buttons.info"), "infopanel", Flags.Editing),
            ],
            [
                InlineButton(t("basic.start.buttons.birthdays"), "birthdays"),
                InlineButton(t("basic.start.buttons.needs"), "needs"),
            ],
            [InlineButton(t("basic.start.buttons.printers"), "printers"), InlineButton(t("basic.start.buttons.help"), "help")],
        ];

        await bot.sendOrEditMessage(
            msg.chat.id,
            t("basic.start.text"),
            msg,
            {
                reply_markup: {
                    inline_keyboard,
                },
            },
            msg.message_id
        );
    }

    static async controlPanelHandler(bot: HackerEmbassyBot, msg: Message) {
        const inline_keyboard = [
            [
                InlineButton(t("basic.control.buttons.unlock"), "unlock"),
                InlineButton(t("basic.control.buttons.doorbell"), "doorbell"),
                InlineButton(t("basic.control.buttons.conditioner"), "conditioner", Flags.Editing),
            ],
            [
                InlineButton(t("basic.control.buttons.webcam"), "webcam"),
                InlineButton(t("basic.control.buttons.webcam2"), "webcam2"),
                InlineButton(t("basic.control.buttons.doorcam"), "doorcam"),
            ],
            [InlineButton(t("basic.control.buttons.superstatus"), "superstatus")],
            [
                InlineButton(t("basic.control.buttons.meme"), "memepanel", Flags.Editing),
                InlineButton(t("basic.control.buttons.back"), "startpanel", Flags.Editing),
            ],
        ];

        await bot.sendOrEditMessage(
            msg.chat.id,
            t("basic.control.text"),
            msg,
            {
                reply_markup: {
                    inline_keyboard,
                },
            },
            msg.message_id
        );
    }

    static async infoPanelHandler(bot: HackerEmbassyBot, msg: Message) {
        const inline_keyboard = [
            [InlineButton(t("basic.info.buttons.about"), "about"), InlineButton(t("basic.info.buttons.join"), "join")],
            [InlineButton(t("basic.info.buttons.location"), "location"), InlineButton(t("basic.info.buttons.donate"), "donate")],
            [
                InlineButton(t("basic.info.buttons.residents"), "getresidents"),
                InlineButton(t("basic.info.buttons.back"), "startpanel", Flags.Editing),
            ],
        ];

        await bot.sendOrEditMessage(
            msg.chat.id,
            t("basic.info.text"),
            msg,
            {
                reply_markup: {
                    inline_keyboard,
                },
            },
            msg.message_id
        );
    }

    static async memePanelHandler(bot: HackerEmbassyBot, msg: Message) {
        const inline_keyboard = [
            [
                InlineButton(t("basic.meme.buttons.moan"), "playinspace", Flags.Silent, { params: "moan" }),
                InlineButton(t("basic.meme.buttons.fart"), "playinspace", Flags.Silent, { params: "fart" }),
                InlineButton(t("basic.meme.buttons.adler"), "playinspace", Flags.Silent, { params: "adler" }),
                InlineButton(t("basic.meme.buttons.rzd"), "playinspace", Flags.Silent, { params: "rzd" }),
            ],
            [
                InlineButton(t("basic.meme.buttons.rickroll"), "playinspace", Flags.Silent, { params: "rickroll" }),
                InlineButton(t("basic.meme.buttons.zhuchok"), "playinspace", Flags.Silent, { params: "zhuchok" }),
                InlineButton(t("basic.meme.buttons.rfoxed"), "playinspace", Flags.Silent, { params: "rfoxed" }),
                InlineButton(t("basic.meme.buttons.nani"), "playinspace", Flags.Silent, { params: "nani" }),
            ],
            [
                InlineButton(t("basic.meme.buttons.cat"), "cat"),
                InlineButton(t("basic.meme.buttons.dog"), "dog"),
                InlineButton(t("basic.meme.buttons.cab"), "cab"),
                InlineButton(t("basic.meme.buttons.cock"), "cock"),
            ],
            [
                InlineButton(t("basic.meme.buttons.sad"), "playinspace", Flags.Silent, { params: "sad" }),
                InlineButton(t("basic.meme.buttons.badumtss"), "playinspace", Flags.Silent, { params: "badumtss" }),
                InlineButton(t("basic.meme.buttons.dushno"), "playinspace", Flags.Silent, { params: "dushno" }),
            ],
            [InlineButton(t("basic.meme.buttons.all"), "availablesounds")],
            [
                InlineButton(t("basic.meme.buttons.stop"), "stopmedia", Flags.Silent),
                InlineButton(t("basic.meme.buttons.back"), "controlpanel", Flags.Editing),
            ],
        ];

        await bot.sendOrEditMessage(
            msg.chat.id,
            t("basic.meme.text"),
            msg,
            {
                reply_markup: {
                    inline_keyboard,
                },
            },
            msg.message_id
        );
    }

    static async upcomingEventsHandler(bot: HackerEmbassyBot, msg: Message) {
        let messageText: string = t("basic.events.upcoming") + "\n";

        try {
            const events = await getClosestEventsFromCalendar(botConfig.calendar.upcomingToLoad);
            messageText += getEventsList(events);
        } catch (error) {
            messageText = t("basic.events.error");
            logger.error(error);
        } finally {
            bot.sendMessageExt(msg.chat.id, messageText, msg);
        }
    }

    static async todayEventsHandler(bot: HackerEmbassyBot, msg: Message) {
        let messageText: string = "";

        try {
            messageText = TextGenerators.getTodayEventsText(await getTodayEvents());
        } catch (error) {
            messageText = t("basic.events.error");
            logger.error(error);
        } finally {
            bot.sendMessageExt(msg.chat.id, messageText, msg);
        }
    }
}
