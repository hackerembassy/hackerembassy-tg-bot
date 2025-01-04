import config from "config";

import TelegramBot, { InlineKeyboardButton, Message } from "node-telegram-bot-api";

import { BotConfig } from "@config";
import StatusRepository from "@repositories/status";
import UsersRepository from "@repositories/users";
import fundsRepository, { COSTS_PREFIX } from "@repositories/funds";
import { DefaultCurrency, sumDonations } from "@services/currency";
import { fetchDevicesInside, requestToEmbassy, EmbassyLinkMacUrl } from "@services/embassy";
import { createUserStatsDonut } from "@services/export";
import * as ExportHelper from "@services/export";
import { SpaceClimate } from "@services/hass";
import logger from "@services/logger";
import { openAI } from "@services/neural";
import {
    filterAllPeopleInside,
    filterPeopleGoing,
    filterPeopleInside,
    isMacInside,
    SpaceStateService,
    UserStateService,
} from "@services/status";
import { sleep } from "@utils/common";
import { getMonthBoundaries, toDateObject, tryDurationStringToMs } from "@utils/date";
import { isEmoji, REPLACE_MARKER } from "@utils/text";

import { State, StateEx, User, UserStateEx } from "data/models";
import { UserStateType, UserStateChangeType, AutoInsideMode } from "data/types";

import { getTodayEventsCached, HSEvent } from "@services/googleCalendar";

import HackerEmbassyBot, { PUBLIC_CHATS } from "../core/HackerEmbassyBot";
import { AnnoyingInlineButton, ButtonFlags, InlineButton, InlineDeepLinkButton, InlineLinkButton } from "../core/InlineButtons";
import t, { SupportedLanguage } from "../core/localization";
import { BotCustomEvent, BotHandlers, BotMessageContextMode } from "../core/types";
import * as helpers from "../core/helpers";
import * as TextGenerators from "../textGenerators";

const botConfig = config.get<BotConfig>("bot");

export default class StatusHandlers implements BotHandlers {
    static isStatusError = false;

    static async setmacHandler(bot: HackerEmbassyBot, msg: Message, cmd: string) {
        const user = bot.context(msg).user;
        const userLink = helpers.userLink(user);

        let message = t("status.mac.fail");
        let inline_keyboard: InlineKeyboardButton[][] = [];

        if (!cmd || cmd === "help") {
            message = t("status.mac.help");
            inline_keyboard = [[InlineLinkButton(t("status.mac.buttons.detect"), EmbassyLinkMacUrl)]];
        } else if (cmd && UsersRepository.testMACs(cmd) && UsersRepository.setMACs(user.userid, cmd)) {
            message = t("status.mac.set", { cmd, username: userLink });
            inline_keyboard = [
                [
                    AnnoyingInlineButton(bot, msg, t("status.mac.buttons.autoinside"), "autoinside", ButtonFlags.Simple, {
                        params: "enable",
                    }),
                ],
            ];
        } else if (cmd === "remove") {
            UsersRepository.setMACs(user.userid, null);
            UsersRepository.updateUser(user.userid, { autoinside: AutoInsideMode.Disabled });
            message = t("status.mac.removed", { username: userLink });
        } else if (cmd === "status") {
            if (user.mac)
                message = t("status.mac.isset", {
                    username: userLink,
                    usermac: user.mac,
                });
            else message = t("status.mac.isnotset", { username: userLink });
        }

        await bot.sendMessageExt(msg.chat.id, message, msg, {
            reply_markup: {
                inline_keyboard,
            },
        });
    }

    static getAutoInsideKeyboard(bot: HackerEmbassyBot, msg: Message, secret: boolean) {
        const inline_keyboard = [
            [
                AnnoyingInlineButton(bot, msg, t("status.autoinside.buttons.status"), "autoinside", ButtonFlags.Simple, {
                    params: "status",
                }),
            ],
            [
                AnnoyingInlineButton(bot, msg, t("status.autoinside.buttons.enable"), "autoinside", ButtonFlags.Simple, {
                    params: "enable",
                }),
                AnnoyingInlineButton(bot, msg, t("status.autoinside.buttons.disable"), "autoinside", ButtonFlags.Simple, {
                    params: "disable",
                }),
            ],
            [AnnoyingInlineButton(bot, msg, t("status.autoinside.buttons.mac"), "setmac", ButtonFlags.Simple)],
        ];

        if (secret) {
            inline_keyboard.splice(2, 0, [
                AnnoyingInlineButton(bot, msg, t("status.autoinside.buttons.ghost"), "autoinside", ButtonFlags.Simple, {
                    params: "ghost",
                }),
            ]);
        }

        return inline_keyboard;
    }

    static async autoinsideHandler(bot: HackerEmbassyBot, msg: Message, cmd: string) {
        const mode = bot.context(msg).mode;
        const user = bot.context(msg).user;
        const userLink = helpers.userLink(user);

        const usermac = user.mac;

        let message = t("status.autoinside.fail");
        let inline_keyboard: InlineKeyboardButton[][] = [];

        try {
            switch (cmd) {
                case "enable":
                case "ghost":
                    if (!usermac) {
                        message = t("status.autoinside.nomac");
                    } else {
                        const mode = cmd === "ghost" ? AutoInsideMode.Ghost : AutoInsideMode.Enabled;
                        UsersRepository.updateUser(user.userid, { autoinside: mode });
                        message = TextGenerators.getAutoinsideMessageStatus(mode as AutoInsideMode, usermac, userLink);
                    }
                    break;
                case "disable":
                    UsersRepository.updateUser(user.userid, { autoinside: AutoInsideMode.Disabled });
                    message = t("status.autoinside.removed", { username: userLink });
                    break;
                case "status":
                    message = TextGenerators.getAutoinsideMessageStatus(user.autoinside as AutoInsideMode, usermac, userLink);
                    break;
                case "help":
                default:
                    inline_keyboard = StatusHandlers.getAutoInsideKeyboard(bot, msg, mode.secret);

                    message = t("status.autoinside.help", { timeout: botConfig.timeouts.out / 60000 });
                    break;
            }
        } catch (error) {
            logger.error(error);
        }

        return await bot.sendMessageExt(msg.chat.id, message, msg, {
            reply_markup: {
                inline_keyboard,
            },
        });
    }

    static getStatusMessage(
        state: StateEx,
        recentUserStates: UserStateEx[],
        mode: BotMessageContextMode,
        short: boolean,
        todayEvents: Nullable<HSEvent[]> = null,
        climateInfo: Nullable<SpaceClimate> = null,
        withSecretData: boolean = false
    ) {
        const inside = recentUserStates.filter(mode.secret ? filterAllPeopleInside : filterPeopleInside);
        const going = recentUserStates.filter(filterPeopleGoing);

        let statusMessage = TextGenerators.getStatusMessage(state, inside, going, todayEvents, climateInfo, {
            short,
            withSecrets: withSecretData,
            isApi: false,
        });

        if (StatusHandlers.isStatusError)
            statusMessage = short ? `📵 ${statusMessage}` : t("status.status.noconnection", { statusMessage });

        return statusMessage;
    }

    private static async queryClimate() {
        let climateInfo: Nullable<SpaceClimate> = null;
        try {
            const response = await requestToEmbassy(`/climate`, "GET", null, 4000);
            climateInfo = (await response.json()) as SpaceClimate;
        } catch (error) {
            logger.error(error);
        }
        return climateInfo;
    }

    static getStatusInlineKeyboard(bot: HackerEmbassyBot, msg: Message, state: State, short: boolean) {
        const inlineKeyboard: InlineKeyboardButton[][] = state.open
            ? [[InlineButton(t("status.buttons.in"), "in"), InlineButton(t("status.buttons.out"), "out")]]
            : [];

        inlineKeyboard.push([
            InlineButton(t("status.buttons.going"), "going"),
            InlineButton(t("status.buttons.notgoing"), "notgoing"),
        ]);

        inlineKeyboard.push(
            short
                ? [InlineButton(t("status.buttons.refresh"), "status", ButtonFlags.Editing, { params: short })]
                : [
                      InlineButton(t("status.buttons.refresh"), "status", ButtonFlags.Editing, { params: short }),
                      AnnoyingInlineButton(bot, msg, t("general.buttons.menu"), "startpanel", ButtonFlags.Editing),
                  ]
        );

        return inlineKeyboard;
    }

    static async liveStatusHandler(
        bot: HackerEmbassyBot,
        resultMessage: Message,
        short: boolean,
        mode: BotMessageContextMode,
        language: SupportedLanguage
    ) {
        sleep(1000); // Delay to prevent sending too many requests at once
        const state = StatusRepository.getSpaceLastState();

        const recentUserStates = bot.botState.flags.hideGuests && !mode.secret ? [] : UserStateService.getRecentUserStates();
        const climateInfo: Nullable<SpaceClimate> = await StatusHandlers.queryClimate();
        const todayEvents = botConfig.features.calendar ? await getTodayEventsCached() : null;

        bot.context(resultMessage).language = language;

        const statusMessage = StatusHandlers.getStatusMessage(
            state,
            recentUserStates,
            mode,
            short,
            todayEvents,
            climateInfo,
            resultMessage.chat.id === botConfig.chats.horny
        );
        const inline_keyboard = StatusHandlers.getStatusInlineKeyboard(bot, resultMessage, state, short);

        try {
            await bot.editMessageTextExt(statusMessage, resultMessage, {
                chat_id: resultMessage.chat.id,
                message_id: resultMessage.message_id,
                reply_markup: {
                    inline_keyboard: mode.static ? [] : inline_keyboard,
                },
            } as TelegramBot.EditMessageTextOptions);
        } catch {
            /* Message was not modified */
        }
    }

    static async liveStatusShortcutHandler(bot: HackerEmbassyBot, msg: Message) {
        const mode = bot.context(msg).mode;
        mode.live = true;
        mode.pin = true;

        await StatusHandlers.statusHandler(bot, msg, true);
    }

    static async statusHandler(bot: HackerEmbassyBot, msg: Message, short: boolean = false) {
        const context = bot.context(msg);
        if (!context.isEditing) bot.sendChatAction(msg.chat.id, "typing", msg);
        const mode = context.mode;
        const language = context.language;

        const state = StatusRepository.getSpaceLastState();
        const recentUserStates = bot.botState.flags.hideGuests && !mode.secret ? [] : UserStateService.getRecentUserStates();
        const todayEvents = botConfig.features.calendar ? await getTodayEventsCached() : null;

        const statusMessage = StatusHandlers.getStatusMessage(state, recentUserStates, mode, short, todayEvents);
        const inline_keyboard = StatusHandlers.getStatusInlineKeyboard(bot, msg, state, short);

        const resultMessage = (await bot.sendOrEditMessage(
            msg.chat.id,
            statusMessage,
            msg,
            {
                reply_markup: {
                    inline_keyboard,
                },
            },
            msg.message_id
        )) as Message;

        const climateInfo: Nullable<SpaceClimate> = await StatusHandlers.queryClimate();

        if (climateInfo) {
            const statusWithClient = statusMessage.replace(
                REPLACE_MARKER,
                TextGenerators.getClimateMessage(climateInfo, {
                    withSecrets: msg.chat.id === botConfig.chats.horny,
                })
            );
            bot.editMessageTextExt(statusWithClient, resultMessage, {
                chat_id: msg.chat.id,
                message_id: resultMessage.message_id,
                reply_markup: {
                    inline_keyboard,
                },
            });
        }

        if (mode.live) {
            bot.addLiveMessage(
                resultMessage,
                BotCustomEvent.statusLive,
                () => StatusHandlers.liveStatusHandler(bot, resultMessage, short, mode, language),
                {
                    functionName: StatusHandlers.liveStatusHandler.name,
                    module: __filename,
                    params: [resultMessage, short, mode, language],
                }
            );
        }
    }

    static async shouldIGoHandler(bot: HackerEmbassyBot, msg: Message) {
        if (!PUBLIC_CHATS.includes(msg.chat.id)) {
            await bot.sendMessageExt(msg.chat.id, t("general.chatnotallowed"), msg);
            return;
        }

        try {
            bot.sendChatAction(msg.chat.id, "typing", msg);

            const state = StatusRepository.getSpaceLastState();
            const recentUserStates = UserStateService.getRecentUserStates();
            const inside = recentUserStates.filter(filterPeopleInside);
            const going = recentUserStates.filter(filterPeopleGoing);
            const user = bot.context(msg).user;

            const prompt = t("status.shouldigo.prompt", {
                state: state.open || user.roles?.includes("member") ? t("status.status.opened") : t("status.status.closed"),
                going: going.length ? going.map(u => u.user.username).join(", ") : 0,
                inside: inside.length ? inside.map(u => u.user.username).join(", ") : 0,
            });

            const aiResponse = await openAI.askChat(prompt, t("status.shouldigo.context"));

            await bot.sendMessageExt(msg.chat.id, aiResponse, msg);
        } catch (error) {
            logger.error(error);
            await bot.sendMessageExt(msg.chat.id, t("status.shouldigo.fail"), msg);
        }
    }

    static async openHandler(bot: HackerEmbassyBot, msg: Message) {
        const opener = bot.context(msg).user;

        SpaceStateService.openSpace(opener, { checkOpener: false });
        bot.CustomEmitter.emit(BotCustomEvent.statusLive);

        const inline_keyboard = [
            [InlineButton(t("status.buttons.in"), "in"), InlineButton(t("status.buttons.reclose"), "close")],
            [AnnoyingInlineButton(bot, msg, t("status.buttons.whoelse"), "status")],
        ];

        await bot.sendMessageExt(msg.chat.id, t("status.open", { username: helpers.formatUsername(msg.from?.username) }), msg, {
            reply_markup: {
                inline_keyboard,
            },
        });
    }

    static async openedNotificationHandler(bot: HackerEmbassyBot, state: StateEx) {
        try {
            await bot.sendMessageExt(
                botConfig.chats.alerts,
                t("status.open-alert", { user: helpers.userLink(state.changer) }),
                null
            );
        } catch (error) {
            logger.error(error);
        }
    }

    static async closedNotificationHandler(bot: HackerEmbassyBot, state: StateEx) {
        try {
            await bot.sendMessageExt(
                botConfig.chats.alerts,
                t("status.close-alert", { user: helpers.userLink(state.changer) }),
                null
            );
        } catch (error) {
            logger.error(error);
        }
    }

    static async closeHandler(bot: HackerEmbassyBot, msg: Message) {
        const closer = bot.context(msg).user;

        SpaceStateService.closeSpace(closer);
        UserStateService.evictPeople();

        bot.CustomEmitter.emit(BotCustomEvent.statusLive);

        const inline_keyboard = [[InlineButton(t("status.buttons.reopen"), "open")]];

        await bot.sendMessageExt(msg.chat.id, t("status.close", { username: helpers.userLink(closer) }), msg, {
            reply_markup: {
                inline_keyboard,
            },
        });
    }

    static async evictHandler(bot: HackerEmbassyBot, msg: Message) {
        UserStateService.evictPeople();
        bot.CustomEmitter.emit(BotCustomEvent.statusLive);

        await bot.sendMessageExt(msg.chat.id, t("status.evict"), msg);
    }

    static inHandler(bot: HackerEmbassyBot, msg: Message, ghost: boolean = false, durationString?: string, username?: string) {
        const context = bot.context(msg);
        const sender = context.user;

        if (ghost && msg.chat.id !== botConfig.chats.key && msg.chat.id !== botConfig.chats.alerts && !context.isPrivate())
            return bot.sendMessageExt(msg.chat.id, "👻", msg);

        const eventDate = new Date();

        const mention = !context.isButtonResponse ? helpers.getMentions(msg)[0] : undefined;
        const force = username !== undefined || mention !== undefined;
        const target = mention
            ? UsersRepository.getUserByUserId(mention.id)
            : username
              ? UsersRepository.getUserByName(username.replace("@", ""))
              : sender;

        if (!target) return bot.sendMessageExt(msg.chat.id, t("general.nouser"), msg);

        const inviterName = force ? helpers.effectiveName(sender) : undefined;
        const durationMs = durationString ? tryDurationStringToMs(durationString) : undefined;
        const until = durationMs ? new Date(eventDate.getTime() + durationMs) : undefined;
        const gotIn = StatusHandlers.LetIn(target, eventDate, until, force, ghost);

        if (gotIn) bot.CustomEmitter.emit(BotCustomEvent.statusLive);

        // TODO ADD FIRST_NAME
        const message = TextGenerators.getInMessage(target.username ?? "", gotIn, context.mode, inviterName, until);

        const inline_keyboard = gotIn
            ? [
                  [InlineButton(t("status.buttons.inandin"), "in"), InlineButton(t("status.buttons.inandout"), "out")],
                  [AnnoyingInlineButton(bot, msg, t("status.buttons.whoinside"), "status")],
              ]
            : [[InlineButton(t("status.buttons.repeat"), "in"), InlineButton(t("status.buttons.open"), "open")]];

        return bot.sendMessageExt(msg.chat.id, message, msg, {
            reply_markup: {
                inline_keyboard,
            },
        });
    }

    static outHandler(bot: HackerEmbassyBot, msg: Message, username?: string) {
        const context = bot.context(msg);
        const sender = context.user;
        const eventDate = new Date();

        const mention = !context.isButtonResponse ? helpers.getMentions(msg)[0] : undefined;
        const force = username !== undefined || mention !== undefined;
        const target = mention
            ? UsersRepository.getUserByUserId(mention.id)
            : username
              ? UsersRepository.getUserByName(username.replace("@", ""))
              : sender;

        if (!target) return bot.sendMessageExt(msg.chat.id, t("general.nouser"), msg);

        const gotOut = StatusHandlers.LetOut(target, eventDate, force);
        let message: string;

        if (gotOut) {
            message = t(force ? "status.outforce.gotout" : "status.out.gotout", {
                username: helpers.userLink(target),
                memberusername: force ? helpers.userLink(sender) : undefined,
            });
            bot.CustomEmitter.emit(BotCustomEvent.statusLive);
        } else {
            message = t(force ? "status.outforce.shouldnot" : "status.out.shouldnot");
        }

        const inline_keyboard = gotOut
            ? [
                  [InlineButton(t("status.buttons.outandout"), "out"), InlineButton(t("status.buttons.outandin"), "in")],
                  [
                      msg.chat.id === botConfig.chats.main
                          ? InlineDeepLinkButton(t("status.buttons.whoinside"), bot.Name!, "status")
                          : InlineButton(t("status.buttons.whoinside"), "status"),
                  ],
              ]
            : [[InlineButton(t("status.buttons.repeat"), "out"), InlineButton(t("status.buttons.open"), "open")]];

        return bot.sendMessageExt(msg.chat.id, message, msg, {
            reply_markup: {
                inline_keyboard,
            },
        });
    }

    static LetIn(user: User, date: Date, until?: Date, force = false, ghost = false) {
        // check that space is open
        const state = StatusRepository.getSpaceLastState();

        if (!state.open && !user.roles?.includes("member") && !force) return false;

        const userstate = {
            status: ghost ? UserStateType.InsideSecret : UserStateType.Inside,
            date: date.getTime(),
            until: until?.getTime() ?? null,
            user_id: user.userid,
            type: force ? UserStateChangeType.Force : UserStateChangeType.Manual,
            note: null,
            user,
        };

        UserStateService.pushPeopleState(userstate);

        return true;
    }

    static LetOut(user: User, date: Date, force = false, timedOut = false) {
        const userstate = {
            status: UserStateType.Outside,
            date: date.getTime(),
            until: null,
            user_id: user.userid,
            type: force ? UserStateChangeType.Force : timedOut ? UserStateChangeType.TimedOut : UserStateChangeType.Manual,
            note: null,
            user,
        };

        UserStateService.pushPeopleState(userstate);

        return true;
    }

    static setGoingState(user: User, isGoing: boolean, note?: string) {
        const eventDate = new Date();

        const userstate = {
            status: isGoing ? UserStateType.Going : UserStateType.Outside,
            date: eventDate.getTime(),
            until: null,
            user_id: user.userid,
            type: UserStateChangeType.Manual,
            note: note ?? null,
            user,
        };

        UserStateService.pushPeopleState(userstate);
    }

    static async goingHandler(bot: HackerEmbassyBot, msg: Message, note?: string) {
        const sender = bot.context(msg).user;

        StatusHandlers.setGoingState(sender, true, note);
        bot.CustomEmitter.emit(BotCustomEvent.statusLive);

        const message = t("status.going", {
            username: helpers.userLink(sender),
            note,
        });

        const inline_keyboard = [
            [
                InlineButton(t("status.buttons.andgoing"), "going"),
                AnnoyingInlineButton(bot, msg, t("status.buttons.whoelse"), "status"),
            ],
        ];

        await bot.sendMessageExt(msg.chat.id, message, msg, {
            reply_markup: {
                inline_keyboard,
            },
        });
    }

    static async notGoingHandler(bot: HackerEmbassyBot, msg: Message) {
        const sender = bot.context(msg).user;

        StatusHandlers.setGoingState(sender, false);
        bot.CustomEmitter.emit(BotCustomEvent.statusLive);

        const message = t("status.notgoing", {
            username: helpers.userLink(sender),
        });

        await bot.sendMessageExt(msg.chat.id, message, msg);
    }

    static async setemojiHandler(bot: HackerEmbassyBot, msg: Message, emoji: string) {
        const sender = bot.context(msg).user;
        const userLink = helpers.userLink(sender);

        let message: string;

        if (!emoji || emoji === "help") {
            message = t("status.emoji.help");
        } else if (emoji && isEmoji(emoji) && UsersRepository.updateUser(sender.userid, { emoji })) {
            message = t("status.emoji.set", { emoji, username: userLink });
        } else if (emoji === "remove") {
            UsersRepository.updateUser(sender.userid, { emoji: null });
            message = t("status.emoji.removed", { username: userLink });
        } else if (emoji === "status" && sender.emoji) {
            message = t("status.emoji.isset", {
                emoji: sender.emoji,
                username: userLink,
            });
        } else {
            message = t("status.emoji.isnotset", { username: userLink });
        }

        await bot.sendMessageExt(msg.chat.id, message, msg);
    }

    static async autoinout(bot: HackerEmbassyBot, isIn: boolean): Promise<void> {
        try {
            const devices = await fetchDevicesInside();
            const autousers = UsersRepository.getAutoinsideUsers();
            const insideUserStates = UserStateService.getRecentUserStates().filter(filterAllPeopleInside);
            const insideUserStatesMap = new Map(insideUserStates.map(u => [u.user_id, u]));

            const selectedautousers = isIn
                ? autousers.filter(u => !insideUserStatesMap.has(u.userid))
                : autousers.filter(u => insideUserStatesMap.get(u.userid)?.type === UserStateChangeType.Auto);

            StatusHandlers.isStatusError = false;

            for (const user of selectedautousers) {
                const hasDeviceInside = isMacInside(user.mac as string, devices);
                if (isIn ? hasDeviceInside : !hasDeviceInside) {
                    const status = isIn
                        ? user.autoinside === AutoInsideMode.Ghost
                            ? UserStateType.InsideSecret
                            : UserStateType.Inside
                        : UserStateType.Outside;

                    UserStateService.pushPeopleState({
                        status,
                        date: Date.now(),
                        until: null,
                        user_id: user.userid,
                        type: UserStateChangeType.Auto,
                        note: null,
                        user,
                    });

                    bot.CustomEmitter.emit(BotCustomEvent.statusLive);

                    logger.info(`User ${user.username} automatically ${isIn ? "got in" : "got out"}`);
                }
            }
        } catch (error) {
            StatusHandlers.isStatusError = true;
            logger.error(error);
        }
    }

    static timedOutHandler(bot: HackerEmbassyBot) {
        const currentDate = new Date();
        const timedOutUsers = UserStateService.getRecentUserStates()
            .filter(filterAllPeopleInside)
            .filter(us => us.until && us.until < currentDate.getTime())
            .map(us => us.user);

        for (const user of timedOutUsers) {
            StatusHandlers.LetOut(user, currentDate);
        }

        if (timedOutUsers.length > 0) bot.CustomEmitter.emit(BotCustomEvent.statusLive);
    }

    static async profileHandler(bot: HackerEmbassyBot, msg: Message, username?: string): Promise<any> {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        const sender = bot.context(msg).user;
        const target = username ? UsersRepository.getUserByName(username.replace("@", "")) : sender;

        if (!target) return bot.sendMessageExt(msg.chat.id, t("status.profile.notfound"), msg);

        const userStates = StatusRepository.getUserStates(target.userid);
        const donations = fundsRepository.getDonationsOf(target.userid, true, true);
        const donationList = donations.length ? TextGenerators.generateFundDonationsList(donations) : "";
        const totalDonated = donations.length ? await sumDonations(donations) : 0;

        const { days, hours, minutes } = UserStateService.getUserTotalTime(userStates);

        const statsText = `${t("status.statsof", {
            username: helpers.userLink(target),
        })}: ${days}d, ${hours}h, ${minutes}m\n\n`;

        const message = `${statsText}${t("status.profile.donated", { donationList })}${t("status.profile.total", {
            total: totalDonated.toFixed(2),
            currency: DefaultCurrency,
        })}`;

        await bot.sendLongMessage(msg.chat.id, message, msg);

        if (donations.length) {
            const filteredDonations = ExportHelper.prepareCostsForExport(donations, COSTS_PREFIX);
            const imageBuffer = await ExportHelper.exportDonationsToLineChart(filteredDonations, COSTS_PREFIX);

            if (imageBuffer.length !== 0) await bot.sendPhotoExt(msg.chat.id, imageBuffer, msg);
        }
    }

    static async statsOfHandler(bot: HackerEmbassyBot, msg: Message, username?: string) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        const sender = bot.context(msg).user;
        const target = username ? (UsersRepository.getUserByName(username.replace("@", "")) ?? sender) : sender;
        const userStates = StatusRepository.getUserStates(target.userid);

        const { days, hours, minutes } = UserStateService.getUserTotalTime(userStates);
        await bot.sendMessageExt(
            msg.chat.id,
            `${t("status.statsof", {
                username: helpers.userLink(target),
            })}: ${days}d, ${hours}h, ${minutes}m\n\n${t("status.stats.tryautoinside")}`,
            msg
        );
    }

    static async statsMonthHandler(bot: HackerEmbassyBot, msg: Message, month?: number) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        const currentDate = new Date();
        const resultDate = new Date();

        if (month !== undefined) {
            if (month > currentDate.getMonth()) {
                resultDate.setFullYear(currentDate.getFullYear() - 1);
            }
            resultDate.setMonth(month);
        }

        const { startMonthDate, endMonthDate } = getMonthBoundaries(resultDate);

        await StatusHandlers.statsHandler(bot, msg, startMonthDate.toDateString(), endMonthDate.toDateString());
    }

    static async statsHandler(bot: HackerEmbassyBot, msg: Message, fromDateString?: string, toDateString?: string): Promise<any> {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        if (!fromDateString && !toDateString) return bot.sendMessageExt(msg.chat.id, t("status.stats.help"), msg);

        const fromDate = new Date(fromDateString ? fromDateString : botConfig.launchDate);
        const toDate = toDateString ? new Date(toDateString) : new Date();
        toDate.setHours(23, 59, 59, 999);

        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime()))
            return bot.sendMessageExt(msg.chat.id, t("status.stats.invaliddates"), msg);

        const userTimes = UserStateService.getAllVisits(fromDate, toDate);
        const shouldMentionPeriod = Boolean(fromDateString || toDateString);
        const dateBoundaries = { from: toDateObject(fromDate), to: toDateObject(toDate) };

        if (userTimes.length === 0) return bot.sendMessageExt(msg.chat.id, t("status.stats.nousertimes"), msg);

        const statsTitle = t("status.stats.hoursinspace", dateBoundaries);
        const statsTexts = TextGenerators.getStatsTexts(userTimes, dateBoundaries, shouldMentionPeriod);

        await bot.sendPhotoExt(msg.chat.id, await createUserStatsDonut(userTimes, statsTitle), msg);

        for (const statsText of statsTexts) {
            await bot.sendMessageExt(msg.chat.id, statsText, msg);
        }
    }
}
