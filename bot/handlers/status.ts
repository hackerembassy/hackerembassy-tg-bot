import config from "config";
import TelegramBot, { InlineKeyboardButton, Message } from "node-telegram-bot-api";

import { BotConfig, EmbassyApiConfig } from "../../config/schema";
import State from "../../models/State";
import { AutoInsideMode } from "../../models/User";
import UserState, { UserStateChangeType, UserStateType } from "../../models/UserState";
import fundsRepository, { COSTS_PREFIX } from "../../repositories/fundsRepository";
import StatusRepository from "../../repositories/statusRepository";
import UsersRepository from "../../repositories/usersRepository";
import { sumDonations } from "../../services/currency";
import { requestToEmbassy } from "../../services/embassy";
import { createUserStatsDonut } from "../../services/export";
import * as ExportHelper from "../../services/export";
import { SpaceClimate } from "../../services/hass";
import logger from "../../services/logger";
import { openAI } from "../../services/neural";
import {
    filterAllPeopleInside,
    filterPeopleGoing,
    filterPeopleInside,
    isMacInside,
    SpaceStateService,
    UserStateService,
} from "../../services/statusHelper";
import { sleep } from "../../utils/common";
import { getMonthBoundaries, toDateObject, tryDurationStringToMs } from "../../utils/date";
import { isEmoji, REPLACE_MARKER } from "../../utils/text";
import HackerEmbassyBot from "../core/HackerEmbassyBot";
import { AnnoyingInlineButton, ButtonFlags, InlineButton, InlineDeepLinkButton } from "../core/InlineButtons";
import t, { SupportedLanguage } from "../core/localization";
import { BotCustomEvent, BotHandlers, BotMessageContextMode } from "../core/types";
import * as helpers from "../helpers";
import * as TextGenerators from "../textGenerators";

const embassyApiConfig = config.get<EmbassyApiConfig>("embassy-api");
const botConfig = config.get<BotConfig>("bot");
const statsStartDateString = "2023-01-01";

export default class StatusHandlers implements BotHandlers {
    static isStatusError = false;

    static async setmacHandler(bot: HackerEmbassyBot, msg: Message, cmd: string) {
        let message = t("status.mac.fail");
        const username = msg.from?.username;
        if (!cmd || cmd === "help") {
            message = t("status.mac.help");
        } else if (cmd && username && UsersRepository.testMACs(cmd) && UsersRepository.setMACs(username, cmd)) {
            message = t("status.mac.set", { cmd, username: helpers.formatUsername(username, bot.context(msg).mode) });
        } else if (cmd === "remove" && username) {
            UsersRepository.setMACs(username, null);
            UsersRepository.setAutoinside(username, AutoInsideMode.Disabled);
            message = t("status.mac.removed", { username: helpers.formatUsername(username, bot.context(msg).mode) });
        } else if (cmd === "status") {
            const usermac = username ? UsersRepository.getUserByName(username)?.mac : undefined;
            if (usermac)
                message = t("status.mac.isset", {
                    username: helpers.formatUsername(username, bot.context(msg).mode),
                    usermac,
                });
            else message = t("status.mac.isnotset", { username: helpers.formatUsername(username, bot.context(msg).mode) });
        }

        await bot.sendMessageExt(msg.chat.id, message, msg);
    }

    static async autoinsideHandler(bot: HackerEmbassyBot, msg: Message, cmd: string) {
        const mode = bot.context(msg).mode;
        const username = msg.from?.username;

        if (!username) return await bot.sendMessageExt(msg.chat.id, t("status.autoinside.notsupported"), msg);

        const user = UsersRepository.getUserByName(username);

        if (!user) return await bot.sendMessageExt(msg.chat.id, t("status.autoinside.nouser"), msg);

        const usermac = user.mac;

        let message = t("status.autoinside.fail");

        try {
            switch (cmd) {
                case "enable":
                case "ghost":
                    if (!usermac) {
                        message = t("status.autoinside.nomac");
                    } else if (
                        UsersRepository.setAutoinside(username, cmd === "ghost" ? AutoInsideMode.Ghost : AutoInsideMode.Enabled)
                    )
                        message = t("status.autoinside.set", {
                            usermac,
                            username: helpers.formatUsername(username, mode),
                        });
                    break;
                case "disable":
                    UsersRepository.setAutoinside(username, AutoInsideMode.Disabled);
                    message = t("status.autoinside.removed", { username: helpers.formatUsername(username, mode) });
                    break;
                case "status":
                    message = TextGenerators.getAutoinsideMessageStatus(user.autoinside, usermac, username, mode);
                    break;
                case "help":
                default:
                    message =
                        t("status.autoinside.help", { timeout: botConfig.timeouts.out / 60000 }) +
                        (mode.secret ? t("status.autoinside.ghost") : "");
                    break;
            }
        } catch (error) {
            logger.error(error);
        }

        return await bot.sendMessageExt(msg.chat.id, message, msg);
    }

    static getStatusMessage(
        state: State,
        recentUserStates: UserState[],
        mode: BotMessageContextMode,
        short: boolean,
        climateInfo: Nullable<SpaceClimate> = null,
        withSecretData: boolean = false
    ) {
        const inside = recentUserStates.filter(mode.secret ? filterAllPeopleInside : filterPeopleInside);
        const going = recentUserStates.filter(filterPeopleGoing);

        let statusMessage = TextGenerators.getStatusMessage(state, inside, going, climateInfo, mode, {
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
        if (!state) return;

        const recentUserStates = bot.botState.flags.hideGuests && !mode.secret ? [] : UserStateService.getRecentUserStates();
        const climateInfo: Nullable<SpaceClimate> = await StatusHandlers.queryClimate();
        bot.context(resultMessage).language = language;

        const statusMessage = StatusHandlers.getStatusMessage(
            state,
            recentUserStates,
            mode,
            short,
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

        if (!state) {
            bot.sendMessageExt(msg.chat.id, t("status.status.undefined"), msg);
            return;
        }

        const statusMessage = StatusHandlers.getStatusMessage(state, recentUserStates, mode, short);
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
        const allowedChats = [
            botConfig.chats.main,
            botConfig.chats.horny,
            botConfig.chats.key,
            botConfig.chats.alerts,
            botConfig.chats.offtopic,
            botConfig.chats.test,
        ];

        if (!allowedChats.includes(msg.chat.id)) {
            await bot.sendMessageExt(msg.chat.id, t("general.chatnotallowed"), msg);
            return;
        }

        try {
            bot.sendChatAction(msg.chat.id, "typing", msg);

            const state = StatusRepository.getSpaceLastState();
            const recentUserStates = UserStateService.getRecentUserStates();
            const inside = recentUserStates.filter(filterPeopleInside);
            const going = recentUserStates.filter(filterPeopleGoing);
            const user = msg.from?.id ? UsersRepository.getByUserId(msg.from.id) : null;

            const prompt = t("status.shouldigo.prompt", {
                state: state?.open || (user && helpers.isMember(user)) ? t("status.status.opened") : t("status.status.closed"),
                going: going.length ? going.map(u => u.username).join(", ") : 0,
                inside: inside.length ? inside.map(u => u.username).join(", ") : 0,
            });
            const context = t("status.shouldigo.context");

            const aiResponse = await openAI.askChat(prompt, context);

            await bot.sendMessageExt(msg.chat.id, aiResponse.content, msg);
        } catch (error) {
            logger.error(error);
            await bot.sendMessageExt(msg.chat.id, t("status.shouldigo.fail"), msg);
        }
    }

    static async openHandler(bot: HackerEmbassyBot, msg: Message) {
        SpaceStateService.openSpace(msg.from?.username, { checkOpener: false });
        bot.CustomEmitter.emit(BotCustomEvent.statusLive);

        const inline_keyboard = [
            [InlineButton(t("status.buttons.in"), "in"), InlineButton(t("status.buttons.reclose"), "close")],
            [AnnoyingInlineButton(bot, msg, t("status.buttons.whoelse"), "status")],
        ];

        await bot.sendMessageExt(
            msg.chat.id,
            t("status.open", { username: helpers.formatUsername(msg.from?.username, bot.context(msg).mode) }),
            msg,
            {
                reply_markup: {
                    inline_keyboard,
                },
            }
        );
    }

    static async openedNotificationHandler(bot: HackerEmbassyBot, state: State) {
        try {
            await bot.sendMessageExt(
                botConfig.chats.alerts,
                t("status.open-alert", { user: helpers.formatUsername(state.changedby, { mention: false }) }),
                null
            );
        } catch (error) {
            logger.error(error);
        }
    }

    static async closedNotificationHandler(bot: HackerEmbassyBot, state: State) {
        try {
            await bot.sendMessageExt(
                botConfig.chats.alerts,
                t("status.close-alert", { user: helpers.formatUsername(state.changedby, { mention: false }) }),
                null
            );
        } catch (error) {
            logger.error(error);
        }
    }

    static async closeHandler(bot: HackerEmbassyBot, msg: Message) {
        SpaceStateService.closeSpace(msg.from?.username);
        UserStateService.evictPeople();

        bot.CustomEmitter.emit(BotCustomEvent.statusLive);

        const inline_keyboard = [[InlineButton(t("status.buttons.reopen"), "open")]];

        await bot.sendMessageExt(
            msg.chat.id,
            t("status.close", { username: helpers.formatUsername(msg.from?.username, bot.context(msg).mode) }),
            msg,
            {
                reply_markup: {
                    inline_keyboard,
                },
            }
        );
    }

    static async evictHandler(bot: HackerEmbassyBot, msg: Message) {
        UserStateService.evictPeople();
        bot.CustomEmitter.emit(BotCustomEvent.statusLive);

        await bot.sendMessageExt(msg.chat.id, t("status.evict"), msg);
    }

    static async inHandler(
        bot: HackerEmbassyBot,
        msg: Message,
        ghost: boolean = false,
        durationString?: string,
        username?: string
    ) {
        const context = bot.context(msg);

        if (ghost && msg.chat.id !== botConfig.chats.key && msg.chat.id !== botConfig.chats.alerts && !context.isPrivate())
            return await bot.sendMessageExt(msg.chat.id, "👻", msg);

        const eventDate = new Date();
        const force = username !== undefined;
        const usernameOrFirstname = username?.replace("@", "") ?? msg.from?.username ?? msg.from?.first_name;
        const inviter = force ? msg.from?.username : undefined;
        const durationMs = durationString ? tryDurationStringToMs(durationString) : undefined;
        const until = durationMs ? new Date(eventDate.getTime() + durationMs) : undefined;
        const gotIn = usernameOrFirstname ? StatusHandlers.LetIn(usernameOrFirstname, eventDate, until, force, ghost) : false;

        if (gotIn) bot.CustomEmitter.emit(BotCustomEvent.statusLive);

        const message = TextGenerators.getInMessage(usernameOrFirstname, gotIn, context.mode, inviter, until);

        const inline_keyboard = gotIn
            ? [
                  [InlineButton(t("status.buttons.inandin"), "in"), InlineButton(t("status.buttons.inandout"), "out")],
                  [AnnoyingInlineButton(bot, msg, t("status.buttons.whoinside"), "status")],
              ]
            : [[InlineButton(t("status.buttons.repeat"), "in"), InlineButton(t("status.buttons.open"), "open")]];

        return await bot.sendMessageExt(msg.chat.id, message, msg, {
            reply_markup: {
                inline_keyboard,
            },
        });
    }

    static async outHandler(bot: HackerEmbassyBot, msg: Message, username?: string) {
        const eventDate = new Date();
        const force = username !== undefined;
        const usernameOrFirstname = username?.replace("@", "") ?? msg.from?.username ?? msg.from?.first_name;
        const gotOut = usernameOrFirstname ? StatusHandlers.LetOut(usernameOrFirstname, eventDate, force) : false;
        let message: string;

        if (gotOut) {
            message = t(force ? "status.outforce.gotout" : "status.out.gotout", {
                username: helpers.formatUsername(usernameOrFirstname, bot.context(msg).mode),
                memberusername: force ? helpers.formatUsername(msg.from?.username, bot.context(msg).mode) : undefined,
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

        await bot.sendMessageExt(msg.chat.id, message, msg, {
            reply_markup: {
                inline_keyboard,
            },
        });
    }

    static LetIn(username: string, date: Date, until?: Date, force = false, ghost = false) {
        // check that space is open
        const state = StatusRepository.getSpaceLastState();

        if (!state?.open && !helpers.hasRole(username, "member") && !force) return false;

        const userstate = {
            id: 0,
            status: ghost ? UserStateType.InsideSecret : UserStateType.Inside,
            date,
            until: until ?? null,
            username: username,
            type: force ? UserStateChangeType.Force : UserStateChangeType.Manual,
            note: null,
        };

        UserStateService.pushPeopleState(userstate);

        return true;
    }

    static LetOut(username: string, date: Date, force = false, timedOut = false) {
        const userstate = {
            id: 0,
            status: UserStateType.Outside,
            date: date,
            until: null,
            username: username,
            type: force ? UserStateChangeType.Force : timedOut ? UserStateChangeType.TimedOut : UserStateChangeType.Manual,
            note: null,
        };

        UserStateService.pushPeopleState(userstate);

        return true;
    }

    static setGoingState(usernameOrFirstname: string, isGoing: boolean, note: string | undefined = undefined) {
        const eventDate = new Date();

        const userstate = {
            id: 0,
            status: isGoing ? UserStateType.Going : UserStateType.Outside,
            date: eventDate,
            until: null,
            username: usernameOrFirstname,
            type: UserStateChangeType.Manual,
            note: note ?? null,
        };

        UserStateService.pushPeopleState(userstate);
    }

    static async goingHandler(bot: HackerEmbassyBot, msg: Message, note: string | undefined = undefined) {
        const usernameOrFirstname = msg.from?.username?.replace("@", "") ?? msg.from?.first_name;
        // TODO add proper handling of username together with firstname
        if (!usernameOrFirstname) return;

        StatusHandlers.setGoingState(usernameOrFirstname, true, note);

        bot.CustomEmitter.emit(BotCustomEvent.statusLive);

        const message = t("status.going", {
            username: helpers.formatUsername(usernameOrFirstname, bot.context(msg).mode),
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
        const usernameOrFirstname = msg.from?.username?.replace("@", "") ?? msg.from?.first_name;
        if (!usernameOrFirstname) return;

        StatusHandlers.setGoingState(usernameOrFirstname, false);

        bot.CustomEmitter.emit(BotCustomEvent.statusLive);

        const message = t("status.notgoing", {
            username: helpers.formatUsername(usernameOrFirstname, bot.context(msg).mode),
        });

        await bot.sendMessageExt(msg.chat.id, message, msg);
    }

    static async setemojiHandler(bot: HackerEmbassyBot, msg: Message, emoji: string) {
        let message = t("status.emoji.fail");
        const username = msg.from?.username;
        if (!emoji || emoji === "help" || !username) {
            message = t("status.emoji.help");
        } else if (emoji && isEmoji(emoji) && UsersRepository.setEmoji(username, emoji)) {
            message = t("status.emoji.set", { emoji, username: helpers.formatUsername(username, bot.context(msg).mode) });
        } else if (emoji === "remove") {
            UsersRepository.setEmoji(username, null);
            message = t("status.emoji.removed", { username: helpers.formatUsername(username, bot.context(msg).mode) });
        } else if (emoji === "status") {
            const emoji = UsersRepository.getUserByName(username)?.emoji;

            if (emoji)
                message = t("status.emoji.isset", {
                    emoji,
                    username: helpers.formatUsername(username, bot.context(msg).mode),
                });
            else message = t("status.emoji.isnotset", { username: helpers.formatUsername(username, bot.context(msg).mode) });
        }

        await bot.sendMessageExt(msg.chat.id, message, msg);
    }

    static async autoinout(bot: HackerEmbassyBot, isIn: boolean): Promise<void> {
        try {
            const response = await requestToEmbassy(`/devices?method=${embassyApiConfig.spacenetwork.devicesCheckingMethod}`);

            if (!response.ok) throw Error("Failed to get devices inside");

            const devices = (await response.json()) as string[];

            const autousers = UsersRepository.getAutoinsideUsers();
            const insideUserStates = UserStateService.getRecentUserStates().filter(filterAllPeopleInside);
            const insideUserStatesMap = new Map(insideUserStates.map(u => [u.username, u]));

            const selectedautousers = isIn
                ? autousers.filter(u => !insideUserStatesMap.has(u.username as string))
                : autousers.filter(u => insideUserStatesMap.get(u.username as string)?.type === UserStateChangeType.Auto);

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
                        id: 0,
                        status,
                        date: new Date(),
                        until: null,
                        username: user.username as string,
                        type: UserStateChangeType.Auto,
                        note: null,
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
            .filter(us => us.until && us.until < currentDate);

        for (const user of timedOutUsers) {
            StatusHandlers.LetOut(user.username, currentDate);
        }

        if (timedOutUsers.length > 0) bot.CustomEmitter.emit(BotCustomEvent.statusLive);
    }

    static async profileHandler(bot: HackerEmbassyBot, msg: Message, username: Optional<string> = undefined) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        const selectedUsername = (username ?? msg.from?.username)?.replace("@", "");
        const userStates = selectedUsername ? StatusRepository.getUserStates(selectedUsername) : [];
        const donations = selectedUsername ? fundsRepository.getFundDonationsOf(selectedUsername) : [];
        const donationList = donations ? TextGenerators.generateFundDonationsList(donations) : "";
        const totalDonated = donations ? await sumDonations(donations) : 0;

        const { days, hours, minutes } = UserStateService.getUserTotalTime(userStates);

        const statsText = `${t("status.statsof", {
            username: helpers.formatUsername(selectedUsername, bot.context(msg).mode),
        })}: ${days}d, ${hours}h, ${minutes}m\n\n`;

        const message = `${statsText}${t("status.profile.donated", { donationList })}${t("status.profile.total", {
            total: totalDonated.toFixed(2),
            currency: "AMD",
        })}`;

        await bot.sendLongMessage(msg.chat.id, message, msg);

        if (donations && donations.length > 0) {
            const filteredDonations = ExportHelper.prepareCostsForExport(donations, COSTS_PREFIX);
            const imageBuffer = await ExportHelper.exportDonationsToLineChart(filteredDonations, COSTS_PREFIX);

            if (imageBuffer.length !== 0) await bot.sendPhotoExt(msg.chat.id, imageBuffer, msg);
        }
    }

    static async statsOfHandler(bot: HackerEmbassyBot, msg: Message, username: Optional<string> = undefined) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        const selectedUsername = (username ?? msg.from?.username)?.replace("@", "");
        const userStates = selectedUsername ? StatusRepository.getUserStates(selectedUsername) : [];

        const { days, hours, minutes } = UserStateService.getUserTotalTime(userStates);
        await bot.sendMessageExt(
            msg.chat.id,
            `${t("status.statsof", {
                username: helpers.formatUsername(selectedUsername, bot.context(msg).mode),
            })}: ${days}d, ${hours}h, ${minutes}m\n\n${t("status.stats.tryautoinside")}`,
            msg
        );
    }

    static async statsMonthHandler(bot: HackerEmbassyBot, msg: Message, month: number | undefined = undefined) {
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

    static async statsHandler(
        bot: HackerEmbassyBot,
        msg: Message,
        fromDateString?: string,
        toDateString?: string
    ): Promise<Message | void> {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        const fromDate = new Date(fromDateString ?? statsStartDateString);
        const toDate = toDateString ? new Date(toDateString) : new Date();
        toDate.setHours(23, 59, 59, 999);

        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
            await bot.sendMessageExt(msg.chat.id, t("status.stats.invaliddates"), msg);
            return;
        }

        const userTimes = UserStateService.getAllVisits(fromDate, toDate);
        const shouldMentionPeriod = Boolean(fromDateString || toDateString);
        const dateBoundaries = { from: toDateObject(fromDate), to: toDateObject(toDate) };

        if (userTimes.length === 0) {
            await bot.sendMessageExt(msg.chat.id, t("status.stats.nousertimes"), msg);
            return;
        }

        const statsText = TextGenerators.getStatsText(userTimes, dateBoundaries, shouldMentionPeriod);
        const statsTitle = t("status.stats.hoursinspace", dateBoundaries);
        const statsDonut = await createUserStatsDonut(userTimes, statsTitle);

        await bot.sendLongMessage(msg.chat.id, statsText, msg);
        await bot.sendPhotoExt(msg.chat.id, statsDonut, msg);
    }
}
