import config from "config";
import { Message } from "node-telegram-bot-api";

import { BotConfig } from "../../config/schema";
import UsersRepository from "../../repositories/usersRepository";
import * as Commands from "../../resources/commands";
import * as GitHub from "../../services/github";
import { getClosestEventsFromCalendar, getTodayEvents } from "../../services/googleCalendar";
import t from "../../services/localization";
import logger from "../../services/logger";
import * as TextGenerators from "../../services/textGenerators";
import { getEventsList } from "../../services/textGenerators";
import * as CoinsHelper from "../../utils/coins";
import { cropStringAtSpace } from "../../utils/text";
import HackerEmbassyBot, { MAX_MESSAGE_LENGTH } from "../core/HackerEmbassyBot";
import { AnnoyingInlineButton, ButtonFlags, InlineButton, InlineLinkButton } from "../core/InlineButtons";
import { BotHandlers, ITelegramUser } from "../core/types";
import * as helpers from "../helpers";
import { isPrivateMessage } from "../helpers";

const botConfig = config.get<BotConfig>("bot");

export default class BasicHandlers implements BotHandlers {
    static async helpHandler(bot: HackerEmbassyBot, msg: Message, role?: string) {
        const selectedRole = role && !Object.keys(Commands.CommandsMap).includes(role) ? "default" : role;

        const text = t("basic.help", {
            availableCommands: helpers.getAvailableCommands(
                msg.from?.username,
                selectedRole as keyof typeof Commands.CommandsMap
            ),
            globalModifiers: Commands.GlobalModifiers,
        });

        return await bot.sendLongMessage(msg.chat.id, text, msg);
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

        const defaultInlineKeyboard = [
            [
                InlineButton(t("basic.events.buttons.today"), "today", ButtonFlags.Editing),
                InlineButton(t("basic.events.buttons.upcoming"), "upcoming", ButtonFlags.Editing),
            ],
            [InlineButton(t("general.buttons.menu"), "startpanel", ButtonFlags.Editing)],
        ];

        const inline_keyboard = isPrivateMessage(msg, bot.context(msg))
            ? [
                  [
                      {
                          text: t("basic.events.opencalendar"),
                          web_app: {
                              url: botConfig.calendar.url,
                          },
                      },
                  ],
                  ...defaultInlineKeyboard,
              ]
            : defaultInlineKeyboard;

        await bot.sendOrEditMessage(
            msg.chat.id,
            message,
            msg,
            {
                reply_markup: {
                    inline_keyboard,
                },
            },
            msg.message_id
        );
    }

    static async issueHandler(bot: HackerEmbassyBot, msg: Message, target: "bot" | "space", issueText: string) {
        if (issueText) {
            const sentMessage = t(`basic.issue.${target}.sent`);
            const report = t(`basic.issue.${target}.report`, {
                issue: issueText,
                reporter: target === "bot" ? helpers.userLink(msg.from as ITelegramUser) : "",
            });
            const shortenedTitle = cropStringAtSpace(issueText, 30);
            const newIssueUrl = GitHub.newSpaceIssueUrl(target, shortenedTitle, issueText);
            const reportTarget = target === "bot" ? botConfig.chats.alerts : botConfig.chats.key;
            const reportKeyboard = [[InlineLinkButton(t("basic.issue.buttons.new"), newIssueUrl)]];

            await bot.sendMessageExt(msg.chat.id, sentMessage, msg);
            delete bot.context(msg).messageThreadId;
            await bot.sendMessageExt(reportTarget, report, msg, { reply_markup: { inline_keyboard: reportKeyboard } });
        } else {
            const helpMessage = t(`basic.issue.${target}.help`);
            const helpKeyboard = [[InlineLinkButton(t("basic.issue.buttons.current"), GitHub.getSpaceIssuesUrl(target))]];

            await bot.sendMessageExt(msg.chat.id, helpMessage, msg, {
                reply_markup: { inline_keyboard: helpKeyboard },
            });
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

    static async donateEquipmentHandler(bot: HackerEmbassyBot, msg: Message) {
        const inline_keyboard = [[AnnoyingInlineButton(bot, msg, t("basic.info.buttons.residents"), "getresidents")]];
        await bot.sendMessageExt(msg.chat.id, t("basic.donateEquipment"), msg, { reply_markup: { inline_keyboard } });
    }

    static async getResidentsHandler(bot: HackerEmbassyBot, msg: Message) {
        const users = UsersRepository.getUsers().filter(u => helpers.hasRole(u.username, "member"));
        const message = TextGenerators.getResidentsList(users, bot.context(msg).mode);

        await bot.sendLongMessage(msg.chat.id, message, msg);
    }

    static async startPanelHandler(bot: HackerEmbassyBot, msg: Message, deepLinkCmd?: string) {
        if (deepLinkCmd) {
            bot.routeMessage({ ...msg, text: `/${deepLinkCmd}` });
            return;
        }

        const inline_keyboard = [
            [InlineButton(t("basic.start.buttons.status"), "status", ButtonFlags.Editing)],
            [
                InlineButton(t("basic.start.buttons.events"), "events", ButtonFlags.Editing),
                InlineButton(t("basic.start.buttons.funds"), "funds", ButtonFlags.Editing),
            ],
            [
                InlineButton(t("basic.start.buttons.control"), "controlpanel", ButtonFlags.Editing),
                InlineButton(t("basic.start.buttons.info"), "infopanel", ButtonFlags.Editing),
            ],
            [
                InlineButton(t("basic.start.buttons.birthdays"), "birthdays", ButtonFlags.Editing),
                InlineButton(t("basic.start.buttons.needs"), "needs", ButtonFlags.Editing),
            ],
            [
                InlineButton(t("basic.start.buttons.printers"), "printers", ButtonFlags.Editing),
                InlineButton(t("basic.start.buttons.topics"), "topics", ButtonFlags.Editing),
            ],
            [InlineButton(t("basic.start.buttons.me"), "me"), InlineButton(t("basic.start.buttons.help"), "help")],
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
            [InlineButton(t("basic.control.buttons.superstatus"), "superstatus")],

            [
                InlineButton(t("basic.control.buttons.unlock"), "unlock"),
                InlineButton(t("basic.control.buttons.doorbell"), "doorbell"),
                InlineButton(t("basic.control.buttons.conditioner"), "conditioner", ButtonFlags.Editing),
            ],
            [
                InlineButton(t("basic.control.buttons.downstairs"), "webcam", ButtonFlags.Simple, { params: "downstairs" }),
                InlineButton(t("basic.control.buttons.downstairs2"), "webcam", ButtonFlags.Simple, { params: "downstairs2" }),
                InlineButton(t("basic.control.buttons.kitchen"), "webcam", ButtonFlags.Simple, { params: "kitchen" }),
            ],
            [
                InlineButton(t("basic.control.buttons.upstairs"), "webcam", ButtonFlags.Simple, { params: "upstairs" }),
                InlineButton(t("basic.control.buttons.printers"), "webcam", ButtonFlags.Simple, { params: "printers" }),
                InlineButton(t("basic.control.buttons.outdoors"), "webcam", ButtonFlags.Simple, { params: "outdoors" }),
            ],
            [
                InlineButton(t("basic.control.buttons.meme"), "memepanel", ButtonFlags.Editing),
                InlineButton(t("general.buttons.back"), "startpanel", ButtonFlags.Editing),
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
                InlineButton(t("general.buttons.back"), "startpanel", ButtonFlags.Editing),
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
                InlineButton(t("basic.meme.buttons.moan"), "playinspace", ButtonFlags.Silent, { params: "moan" }),
                InlineButton(t("basic.meme.buttons.fart"), "playinspace", ButtonFlags.Silent, { params: "fart" }),
                InlineButton(t("basic.meme.buttons.adler"), "playinspace", ButtonFlags.Silent, { params: "adler" }),
                InlineButton(t("basic.meme.buttons.rzd"), "playinspace", ButtonFlags.Silent, { params: "rzd" }),
            ],
            [
                InlineButton(t("basic.meme.buttons.rickroll"), "playinspace", ButtonFlags.Silent, { params: "rickroll" }),
                InlineButton(t("basic.meme.buttons.zhuchok"), "playinspace", ButtonFlags.Silent, { params: "zhuchok" }),
                InlineButton(t("basic.meme.buttons.rfoxed"), "playinspace", ButtonFlags.Silent, { params: "rfoxed" }),
                InlineButton(t("basic.meme.buttons.nani"), "playinspace", ButtonFlags.Silent, { params: "nani" }),
            ],
            [
                InlineButton(t("basic.meme.buttons.cat"), "cat", ButtonFlags.Simple, { params: "./resources/images/cats" }),
                InlineButton(t("basic.meme.buttons.dog"), "dog", ButtonFlags.Simple, { params: "./resources/images/dogs" }),
                InlineButton(t("basic.meme.buttons.cab"), "cab", ButtonFlags.Simple, { params: "./resources/images/cab" }),
                InlineButton(t("basic.meme.buttons.cock"), "cock", ButtonFlags.Simple, { params: "./resources/images/roosters" }),
            ],
            [
                InlineButton(t("basic.meme.buttons.sad"), "playinspace", ButtonFlags.Silent, { params: "sad" }),
                InlineButton(t("basic.meme.buttons.badumtss"), "playinspace", ButtonFlags.Silent, { params: "badumtss" }),
                InlineButton(t("basic.meme.buttons.dushno"), "playinspace", ButtonFlags.Silent, { params: "dushno" }),
            ],
            [InlineButton(t("basic.meme.buttons.all"), "availablesounds")],
            [
                InlineButton(t("basic.meme.buttons.stop"), "stopmedia", ButtonFlags.Silent),
                InlineButton(t("general.buttons.back"), "controlpanel", ButtonFlags.Editing),
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

    static async upcomingEventsHandler(
        bot: HackerEmbassyBot,
        msg: Message,
        numberOfEvents: number = botConfig.calendar.upcomingToLoad
    ) {
        let messageText: string = t("basic.events.upcoming") + "\n";

        const inline_keyboard = [[InlineButton(t("basic.start.buttons.events"), "events", ButtonFlags.Editing)]];

        try {
            const events = await getClosestEventsFromCalendar(numberOfEvents);
            messageText += getEventsList(events).slice(0, MAX_MESSAGE_LENGTH);
        } catch (error) {
            messageText = t("basic.events.error");
            logger.error(error);
        } finally {
            bot.sendOrEditMessage(
                msg.chat.id,
                messageText,
                msg,
                {
                    reply_markup: {
                        inline_keyboard,
                    },
                },
                msg.message_id
            );
        }
    }

    static async todayEventsHandler(bot: HackerEmbassyBot, msg: Message) {
        let messageText: string = "";

        const inline_keyboard = [[InlineButton(t("basic.start.buttons.events"), "events", ButtonFlags.Editing)]];

        try {
            messageText = TextGenerators.getTodayEventsText(await getTodayEvents());
        } catch (error) {
            messageText = t("basic.events.error");
            logger.error(error);
        } finally {
            bot.sendOrEditMessage(
                msg.chat.id,
                messageText,
                msg,
                {
                    reply_markup: {
                        inline_keyboard,
                    },
                },
                msg.message_id
            );
        }
    }
}
