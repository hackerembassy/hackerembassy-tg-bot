import config from "config";

import { Message } from "node-telegram-bot-api";

import { CommandsMap, GlobalModifiers } from "@constants/commands";
import { UserRole } from "@data/types";

import { BotConfig } from "@config";
import { getCoinDefinition, getCoinQR } from "@services/domain/funds/currency";
import { hasRole, splitRoles, userService } from "@services/domain/user";
import * as GitHub from "@services/external/github";
import { calendarUrl, getClosestEventsFromCalendar, getTodayEvents } from "@services/external/googleCalendar";
import logger from "@services/common/logger";
import { cropStringAtSpace } from "@utils/text";
import { FeatureFlag, Members, Route, TrustedMembers, UserRoles } from "@hackembot/core/decorators";

import { MAX_MESSAGE_LENGTH } from "../core/constants";
import HackerEmbassyBot from "../core/classes/HackerEmbassyBot";
import { ButtonFlags, InlineButton, InlineButtonResult, InlineLinkButton } from "../core/inlineButtons";
import t from "../core/localization";
import { BotController, ITelegramUser } from "../core/types";
import * as helpers from "../core/helpers";
import * as TextGenerators from "../text";
import { getEventsList } from "../text";
import { OptionalParam } from "../core/helpers";

const botConfig = config.get<BotConfig>("bot");

export default class BasicController implements BotController {
    @Route(["help"], OptionalParam(/(\S+)/), match => [match[1]])
    static async helpHandler(bot: HackerEmbassyBot, msg: Message, role?: string) {
        const selectedRole = role && !Object.keys(CommandsMap).includes(role) ? "default" : role;
        const userRoles = splitRoles(bot.context(msg).user);
        userRoles.push("default");

        const availableCommands =
            role && userRoles.includes(role as UserRole)
                ? CommandsMap[selectedRole as keyof typeof CommandsMap]
                : Object.keys(CommandsMap)
                      .filter(r => userRoles.includes(r as keyof typeof CommandsMap))
                      .map(r => CommandsMap[r as keyof typeof CommandsMap])
                      .join("");

        const text = t("basic.help", {
            availableCommands,
            globalModifiers: GlobalModifiers,
        });

        return await bot.sendLongMessage(msg.chat.id, text, msg);
    }

    @Route(["about"])
    static async aboutHandler(bot: HackerEmbassyBot, msg: Message) {
        const inline_keyboard = [
            [InlineButton(t("general.buttons.readmore"), "infopanel", { flags: ButtonFlags.Editing, deeplink: "public" })],
        ];
        const text = TextGenerators.getAboutText();

        await bot.sendOrEditMessage(
            msg.chat.id,
            text,
            msg,
            {
                reply_markup: {
                    inline_keyboard,
                },
            },
            msg.message_id
        );
    }

    @Route(["join"])
    static async joinHandler(bot: HackerEmbassyBot, msg: Message) {
        const inline_keyboard = [
            [InlineButton(t("general.buttons.readmore"), "infopanel", { flags: ButtonFlags.Editing, deeplink: "public" })],
        ];
        const text = TextGenerators.getJoinText();

        await bot.sendOrEditMessage(
            msg.chat.id,
            text,
            msg,
            {
                reply_markup: {
                    inline_keyboard,
                },
            },
            msg.message_id
        );
    }

    @Route(["events"])
    static async eventsHandler(bot: HackerEmbassyBot, msg: Message) {
        const text = TextGenerators.getEventsText(botConfig.features.calendar, `${bot.url}/calendar`);

        // Telegram only allows web_app buttons in private chats
        const calendarButton: InlineButtonResult = {
            text: t("basic.events.opencalendar"),
            web_app: { url: calendarUrl },
            display: "private",
        };

        const inline_keyboard = [
            botConfig.features.calendar ? [calendarButton] : [],
            botConfig.features.calendar
                ? [
                      InlineButton(t("basic.events.buttons.today"), "today", { flags: ButtonFlags.Editing, deeplink: "public" }),
                      InlineButton(t("basic.events.buttons.upcoming"), "upcoming", {
                          flags: ButtonFlags.Editing,
                          deeplink: "public",
                      }),
                  ]
                : [],
            [InlineButton(t("general.buttons.menu"), "startpanel", { flags: ButtonFlags.Editing, deeplink: "public" })],
        ];

        await bot.sendOrEditMessage(
            msg.chat.id,
            text,
            msg,
            {
                reply_markup: {
                    inline_keyboard,
                },
            },
            msg.message_id
        );
    }

    @Route(["issue", "report"], OptionalParam(/(.*)/ims), match => ["space", match[1]])
    @Route(["bug", "bugreport"], OptionalParam(/(.*)/ims), match => ["bot", match[1]])
    static async issueHandler(bot: HackerEmbassyBot, msg: Message, target: "bot" | "space", issueText: string) {
        if (issueText) {
            const sentMessage = t(`basic.issue.${target}.sent`);
            const report = t(`basic.issue.${target}.report`, {
                issue: issueText,
                reporter: target === "bot" ? helpers.tgUserLink(msg.from as ITelegramUser) : "",
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

    @Route(["donate"])
    static async donateHandler(bot: HackerEmbassyBot, msg: Message) {
        const inline_keyboard = [
            [
                InlineButton(t("basic.start.buttons.funds"), "funds", { deeplink: "public" }),
                InlineButton(t("general.buttons.readmore"), "infopanel", { flags: ButtonFlags.Editing, deeplink: "public" }),
            ],
        ];

        const accountants = userService.getUsersByRole("accountant");
        const message = TextGenerators.getDonateText(accountants);
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

    @Route(["location", "where"])
    static async locationHandler(bot: HackerEmbassyBot, msg: Message) {
        await bot.sendPhotoExt(msg.chat.id, "./resources/images/house.jpg", msg, { caption: t("basic.location.address") });
        await bot.sendLocationExt(msg.chat.id, 40.194336, 44.497607, msg);
    }

    @Route(["donatecrypto", "crypto"], /(btc|eth|usdc|usdt|trx|ton)/, match => [match[1]])
    @Route(["btc"], null, () => ["btc"])
    @Route(["eth"], null, () => ["eth"])
    @Route(["usdc"], null, () => ["usdc"])
    @Route(["usdt"], null, () => ["usdt"])
    @Route(["trx"], null, () => ["trx"])
    @Route(["ton"], null, () => ["ton"])
    static async donateCoinHandler(bot: HackerEmbassyBot, msg: Message, coinname: string) {
        const coinDefinition = getCoinDefinition(coinname.toLowerCase());

        if (!coinDefinition) {
            await bot.sendMessageExt(msg.chat.id, t("basic.donateCoin.invalidCoin"), msg);
            return;
        }

        const qrImage = await getCoinQR(coinDefinition);

        await bot.sendPhotoExt(msg.chat.id, qrImage, msg, {
            caption: t("basic.donateCoin", { coin: coinDefinition }),
        });
    }

    @Route(["donatecash", "cash"])
    static async donateCashHandler(bot: HackerEmbassyBot, msg: Message) {
        const accountantsList = TextGenerators.getAccountsList(userService.getUsersByRole("accountant"), bot.context(msg).mode);

        await bot.sendOrEditMessage(msg.chat.id, t("basic.donateCash", { accountantsList }), msg, {}, msg.message_id);
    }

    @Route(["donatecard", "card"])
    static async donateCardHandler(bot: HackerEmbassyBot, msg: Message) {
        const accountantsList = TextGenerators.getAccountsList(userService.getUsersByRole("accountant"), bot.context(msg).mode);

        await bot.sendOrEditMessage(
            msg.chat.id,
            t("basic.donateCard", {
                accountantsList,
                accountNumber: botConfig.funds.payment.accountNumber,
                accountHolder: botConfig.funds.payment.accountHolder,
                cardNumber: botConfig.funds.payment.cardNumber,
            }),
            msg,
            {},
            msg.message_id
        );
    }

    @Route(["donateequipment", "equipment"])
    static async donateEquipmentHandler(bot: HackerEmbassyBot, msg: Message) {
        const inline_keyboard = [[InlineButton(t("basic.info.buttons.residents"), "getresidents", { deeplink: "public" })]];
        await bot.sendOrEditMessage(
            msg.chat.id,
            t("basic.donateEquipment"),
            msg,
            { reply_markup: { inline_keyboard } },
            msg.message_id
        );
    }

    @Route(["getresidents", "gr", "residents", "members"])
    static async getResidentsHandler(bot: HackerEmbassyBot, msg: Message) {
        const inline_keyboard = [
            [InlineButton(t("general.buttons.readmore"), "infopanel", { flags: ButtonFlags.Editing, deeplink: "public" })],
        ];
        const users = userService.getUsersByRole("member");
        const message = TextGenerators.getResidentsList(users, bot.context(msg).mode);

        await bot.sendOrEditMessage(msg.chat.id, message, msg, { reply_markup: { inline_keyboard } }, msg.message_id);
    }

    @Route(["start", "startpanel", "sp"])
    static async startPanelHandler(bot: HackerEmbassyBot, msg: Message) {
        const context = bot.context(msg);
        // Disable the control panel for non-members, but only in private - group keyboards are shared
        const controlPanelButton = InlineButton(t("basic.start.buttons.control"), "controlpanel", {
            flags: ButtonFlags.Editing,
            disabled: context.isPrivate() && !hasRole(context.user, ...Members),
        });

        const inline_keyboard = [
            [InlineButton(t("basic.start.buttons.status"), "status", { flags: ButtonFlags.Editing })],
            [
                InlineButton(t("basic.start.buttons.events"), "events", { flags: ButtonFlags.Editing }),
                InlineButton(t("basic.start.buttons.funds"), "funds", { flags: ButtonFlags.Editing }),
            ],
            [
                InlineButton(t("basic.start.buttons.topics"), "topics", { flags: ButtonFlags.Editing }),
                InlineButton(t("basic.start.buttons.info"), "infopanel", { flags: ButtonFlags.Editing }),
            ],
            [
                InlineButton(t("basic.start.buttons.birthdays"), "birthdays", { flags: ButtonFlags.Editing }),
                InlineButton(t("basic.start.buttons.needs"), "needs", { flags: ButtonFlags.Editing }),
            ],
            botConfig.features.embassy
                ? [
                      controlPanelButton,
                      InlineButton(t("basic.start.buttons.printers"), "printers", { flags: ButtonFlags.Editing }),
                  ]
                : [],
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

    @Route(["controlpanel", "cp"])
    @FeatureFlag("embassy")
    @UserRoles(Members)
    static async controlPanelHandler(bot: HackerEmbassyBot, msg: Message) {
        const inline_keyboard = [
            [InlineButton(t("basic.control.buttons.superstatus"), "superstatus")],
            [
                InlineButton(t("basic.control.buttons.conditioner2"), "ac2", { flags: ButtonFlags.Editing, params: "upstairs" }),
                InlineButton(t("basic.control.buttons.conditioner1"), "ac1", {
                    flags: ButtonFlags.Editing,
                    params: "downstairs",
                }),
            ],
            [
                InlineButton(t("basic.control.buttons.downstairs"), "webcam", { params: "downstairs" }),
                InlineButton(t("basic.control.buttons.upstairs"), "webcam", { params: "upstairs" }),
                InlineButton(t("basic.control.buttons.upstairs_ptz"), "webcam", { params: "upstairs_ptz" }),
            ],
            [
                InlineButton(t("basic.control.buttons.kitchen"), "webcam", { params: "kitchen" }),
                InlineButton(t("basic.control.buttons.balcony"), "webcam", { params: "balcony" }),
                InlineButton(t("basic.control.buttons.meeting_room"), "webcam", { params: "meeting_room" }),
            ],
            [
                InlineButton(t("basic.control.buttons.printers"), "webcam", { params: "printers" }),
                InlineButton(t("basic.control.buttons.facecontrol"), "webcam", { params: "facecontrol" }),
                InlineButton(t("basic.control.buttons.gateway"), "webcam", { params: "gateway" }),
            ],
            [
                InlineButton(t("basic.control.buttons.unlock"), "unlock"),
                InlineButton(t("basic.control.buttons.meme"), "memepanel", { flags: ButtonFlags.Editing }),
                InlineButton(t("general.buttons.back"), "startpanel", { flags: ButtonFlags.Editing }),
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

    @Route(["infopanel", "info", "ip", "faq"])
    static async infoPanelHandler(bot: HackerEmbassyBot, msg: Message) {
        const inline_keyboard = [
            [
                InlineButton(t("basic.info.buttons.about"), "about", { flags: ButtonFlags.Editing }),
                InlineButton(t("basic.info.buttons.join"), "join", { flags: ButtonFlags.Editing }),
            ],
            [
                InlineButton(t("basic.info.buttons.location"), "location", { flags: ButtonFlags.Editing }),
                InlineButton(t("basic.info.buttons.donate"), "donate", { flags: ButtonFlags.Editing }),
            ],
            [
                InlineButton(t("basic.info.buttons.residents"), "getresidents", { flags: ButtonFlags.Editing }),
                InlineButton(t("basic.info.buttons.sponsors"), "getsponsors", { flags: ButtonFlags.Editing }),
            ],
            [InlineButton(t("basic.info.buttons.wiki"), "wiki", { flags: ButtonFlags.Editing })],
            [InlineButton(t("general.buttons.menu"), "startpanel", { flags: ButtonFlags.Editing })],
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

    @Route(["memepanel", "meme", "memes", "mp"])
    @UserRoles(TrustedMembers)
    static async memePanelHandler(bot: HackerEmbassyBot, msg: Message) {
        const inline_keyboard = [
            [
                InlineButton(t("basic.meme.buttons.cat"), "cat", { params: "./resources/images/cats" }),
                InlineButton(t("basic.meme.buttons.dog"), "dog", { params: "./resources/images/dogs" }),
                InlineButton(t("basic.meme.buttons.cock"), "cock", { params: "./resources/images/roosters" }),
            ],
        ];

        if (botConfig.features.embassy)
            inline_keyboard.push(
                [
                    InlineButton(t("basic.meme.buttons.moan"), "playinspace", { flags: ButtonFlags.Silent, params: "moan" }),
                    InlineButton(t("basic.meme.buttons.fart"), "playinspace", { flags: ButtonFlags.Silent, params: "fart" }),
                    InlineButton(t("basic.meme.buttons.adler"), "playinspace", { flags: ButtonFlags.Silent, params: "adler" }),
                    InlineButton(t("basic.meme.buttons.rzd"), "playinspace", { flags: ButtonFlags.Silent, params: "rzd" }),
                ],
                [
                    InlineButton(t("basic.meme.buttons.rickroll"), "playinspace", {
                        flags: ButtonFlags.Silent,
                        params: "rickroll",
                    }),
                    InlineButton(t("basic.meme.buttons.zhuchok"), "playinspace", {
                        flags: ButtonFlags.Silent,
                        params: "zhuchok",
                    }),
                    InlineButton(t("basic.meme.buttons.rfoxed"), "playinspace", { flags: ButtonFlags.Silent, params: "rfoxed" }),
                    InlineButton(t("basic.meme.buttons.nani"), "playinspace", { flags: ButtonFlags.Silent, params: "nani" }),
                ],

                [
                    InlineButton(t("basic.meme.buttons.sad"), "playinspace", { flags: ButtonFlags.Silent, params: "sad" }),
                    InlineButton(t("basic.meme.buttons.badumtss"), "playinspace", {
                        flags: ButtonFlags.Silent,
                        params: "badumtss",
                    }),
                    InlineButton(t("basic.meme.buttons.dushno"), "playinspace", { flags: ButtonFlags.Silent, params: "dushno" }),
                ],
                [InlineButton(t("basic.meme.buttons.all"), "availablesounds")],
                [
                    InlineButton(t("basic.meme.buttons.stop"), "stopmedia", { flags: ButtonFlags.Silent }),
                    InlineButton(t("general.buttons.back"), "controlpanel", { flags: ButtonFlags.Editing }),
                ]
            );

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

    @Route(["upcomingevents", "ue", "upcoming", "upcumingevents", "upcuming"], OptionalParam(/(\d)/), match => [match[1]])
    @FeatureFlag("calendar")
    static async upcomingEventsHandler(bot: HackerEmbassyBot, msg: Message, numberOfEvents?: number) {
        let messageText: string = t("basic.events.upcoming") + "\n";

        const inline_keyboard = [
            [
                InlineButton(t("basic.info.buttons.donate"), "donate", { flags: ButtonFlags.Editing, deeplink: "public" }),
                InlineButton(t("basic.start.buttons.events"), "events", { flags: ButtonFlags.Editing, deeplink: "public" }),
            ],
        ];

        try {
            const events = await getClosestEventsFromCalendar(numberOfEvents);
            messageText += getEventsList(events).slice(0, MAX_MESSAGE_LENGTH);
        } catch (error) {
            messageText = t("basic.events.error");
            logger.error(error);
        } finally {
            void bot.sendOrEditMessage(
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

    @Route(["todayevents", "today", "te"])
    @FeatureFlag("calendar")
    static async todayEventsHandler(bot: HackerEmbassyBot, msg: Message) {
        let messageText: string = "";

        const inline_keyboard = [
            [
                InlineButton(t("basic.info.buttons.donate"), "donate", { flags: ButtonFlags.Editing, deeplink: "public" }),
                InlineButton(t("basic.start.buttons.events"), "events", { flags: ButtonFlags.Editing, deeplink: "public" }),
            ],
        ];

        try {
            messageText = TextGenerators.getTodayEventsText(await getTodayEvents());
        } catch (error) {
            messageText = t("basic.events.error");
            logger.error(error);
        } finally {
            void bot.sendOrEditMessage(
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
