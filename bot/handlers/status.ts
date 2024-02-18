import config from "config";
import TelegramBot, { Message } from "node-telegram-bot-api";

import { BotConfig, EmbassyApiConfig } from "../../config/schema";
import State from "../../models/State";
import { UserStateChangeType, UserStateType } from "../../models/UserState";
import fundsRepository, { COSTS_PREFIX } from "../../repositories/fundsRepository";
import StatusRepository from "../../repositories/statusRepository";
import UsersRepository from "../../repositories/usersRepository";
import { requestToEmbassy } from "../../services/embassy";
import { createUserStatsDonut } from "../../services/export";
import * as ExportHelper from "../../services/export";
import { SpaceClimate } from "../../services/hass";
import t from "../../services/localization";
import logger from "../../services/logger";
import {
    closeSpace,
    evictPeople,
    filterPeopleGoing,
    filterPeopleInside,
    findRecentStates,
    getAllUsersTimes,
    getUserTimeDescriptor,
    isMacInside,
    openSpace,
} from "../../services/statusHelper";
import * as TextGenerators from "../../services/textGenerators";
import { sleep } from "../../utils/common";
import { sumDonations } from "../../utils/currency";
import { getMonthBoundaries, toDateObject } from "../../utils/date";
import { isEmoji, REPLACE_MARKER } from "../../utils/text";
import HackerEmbassyBot from "../core/HackerEmbassyBot";
import { BotCustomEvent, BotHandlers, BotMessageContextMode } from "../core/types";
import * as helpers from "../helpers";
import { InlineButton } from "../helpers";
import { Flags } from "./service";

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
            UsersRepository.setAutoinside(username, false);
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
        let message = t("status.autoinside.fail");
        const username = msg.from?.username;
        const user = username ? UsersRepository.getUserByName(username) : undefined;
        const usermac = user?.mac;
        const userautoinside = user?.autoinside;

        if (!cmd || cmd === "help") {
            message = t("status.autoinside.help", { timeout: botConfig.timeouts.out / 60000 });
        } else if (cmd === "enable" && username) {
            if (!usermac) message = t("status.autoinside.nomac");
            else if (UsersRepository.setAutoinside(username, true))
                message = t("status.autoinside.set", {
                    usermac,
                    username: helpers.formatUsername(username, bot.context(msg).mode),
                });
        } else if (cmd === "disable" && username) {
            UsersRepository.setAutoinside(username, false);
            message = t("status.autoinside.removed", { username: helpers.formatUsername(username, bot.context(msg).mode) });
        } else if (cmd === "status") {
            if (userautoinside)
                message = t("status.autoinside.isset", {
                    usermac,
                    username: helpers.formatUsername(username, bot.context(msg).mode),
                });
            else
                message = t("status.autoinside.isnotset", {
                    username: helpers.formatUsername(username, bot.context(msg).mode),
                });
        }

        await bot.sendMessageExt(msg.chat.id, message, msg);
    }

    static getStatusMessage(
        state: State,
        mode: BotMessageContextMode,
        short: boolean,
        climateInfo: Nullable<SpaceClimate> = null,
        withSecretData: boolean = false
    ) {
        const recentUserStates = findRecentStates(StatusRepository.getAllUserStates() ?? []);
        const inside = recentUserStates.filter(filterPeopleInside);
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

    static getStatusInlineKeyboard(state: State, short: boolean) {
        const inlineKeyboard = state.open
            ? [[InlineButton(t("status.buttons.in"), "in"), InlineButton(t("status.buttons.out"), "out")]]
            : [];

        inlineKeyboard.push([
            InlineButton(t("status.buttons.going"), "going"),
            InlineButton(t("status.buttons.notgoing"), "notgoing"),
        ]);

        inlineKeyboard.push(
            short
                ? [InlineButton(t("status.buttons.refresh"), "status", Flags.Editing, { params: short })]
                : [
                      InlineButton(t("status.buttons.refresh"), "status", Flags.Editing, { params: short }),
                      InlineButton(t("general.buttons.menu"), "startpanel", Flags.Editing),
                  ]
        );

        return inlineKeyboard;
    }

    static async liveStatusHandler(bot: HackerEmbassyBot, resultMessage: Message, short: boolean, mode: BotMessageContextMode) {
        sleep(1000); // Delay to prevent sending too many requests at once
        const state = StatusRepository.getSpaceLastState() as State;
        const climateInfo: Nullable<SpaceClimate> = await StatusHandlers.queryClimate();

        const statusMessage = StatusHandlers.getStatusMessage(
            state,
            mode,
            short,
            climateInfo,
            resultMessage.chat.id === botConfig.chats.horny
        );
        const inline_keyboard = StatusHandlers.getStatusInlineKeyboard(state, short);

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

    static async statusHandler(bot: HackerEmbassyBot, msg: Message, short: boolean = false) {
        if (!bot.context(msg).isEditing) bot.sendChatAction(msg.chat.id, "typing", msg);
        const state = StatusRepository.getSpaceLastState();
        const mode = bot.context(msg).mode;

        if (!state) {
            bot.sendMessageExt(msg.chat.id, t("status.status.undefined"), msg);
            return;
        }

        const statusMessage = StatusHandlers.getStatusMessage(state, mode, short);
        const inline_keyboard = StatusHandlers.getStatusInlineKeyboard(state, short);

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
                () => StatusHandlers.liveStatusHandler(bot, resultMessage, short, mode),
                {
                    functionName: StatusHandlers.liveStatusHandler.name,
                    module: __filename,
                    params: [resultMessage, short, mode],
                }
            );
        }
    }

    static async openHandler(bot: HackerEmbassyBot, msg: Message) {
        openSpace(msg.from?.username, { checkOpener: false });
        bot.CustomEmitter.emit(BotCustomEvent.statusLive);

        const inline_keyboard = [
            [InlineButton(t("status.buttons.in"), "in"), InlineButton(t("status.buttons.reclose"), "close")],
            [InlineButton(t("status.buttons.whoinside"), "status")],
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
        closeSpace(msg.from?.username, { evict: true });
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
        evictPeople(findRecentStates(StatusRepository.getAllUserStates() ?? []).filter(filterPeopleInside));
        bot.CustomEmitter.emit(BotCustomEvent.statusLive);

        await bot.sendMessageExt(msg.chat.id, t("status.evict"), msg);
    }

    static async inHandler(bot: HackerEmbassyBot, msg: Message) {
        const eventDate = new Date();
        const usernameOrFirstname = msg.from?.username ?? msg.from?.first_name;
        const gotIn = usernameOrFirstname ? StatusHandlers.LetIn(usernameOrFirstname, eventDate) : false;

        let message: string;

        if (gotIn) {
            message = t("status.in.gotin", { username: helpers.formatUsername(usernameOrFirstname, bot.context(msg).mode) });
            bot.CustomEmitter.emit(BotCustomEvent.statusLive);
        } else {
            message = t("status.in.notready");
        }

        const inline_keyboard = gotIn
            ? [
                  [InlineButton(t("status.buttons.inandin"), "in"), InlineButton(t("status.buttons.inandout"), "out")],
                  [InlineButton(t("status.buttons.whoinside"), "status")],
              ]
            : [[InlineButton(t("status.buttons.repeat"), "in"), InlineButton(t("status.buttons.open"), "open")]];

        await bot.sendMessageExt(msg.chat.id, message, msg, {
            reply_markup: {
                inline_keyboard,
            },
        });
    }

    static async outHandler(bot: HackerEmbassyBot, msg: Message) {
        const eventDate = new Date();
        const usernameOrFirstname = msg.from?.username ?? msg.from?.first_name;
        const gotOut = usernameOrFirstname ? StatusHandlers.LetOut(usernameOrFirstname, eventDate) : false;
        let message: string;

        if (gotOut) {
            message = t("status.out.gotout", {
                username: helpers.formatUsername(usernameOrFirstname, bot.context(msg).mode),
            });
            bot.CustomEmitter.emit(BotCustomEvent.statusLive);
        } else {
            message = t("status.out.shouldnot");
        }

        const inline_keyboard = gotOut
            ? [
                  [InlineButton(t("status.buttons.outandout"), "out"), InlineButton(t("status.buttons.outandin"), "in")],
                  [InlineButton(t("status.buttons.whoinside"), "status")],
              ]
            : [[InlineButton(t("status.buttons.repeat"), "out"), InlineButton(t("status.buttons.open"), "open")]];

        await bot.sendMessageExt(msg.chat.id, message, msg, {
            reply_markup: {
                inline_keyboard,
            },
        });
    }

    static async inForceHandler(bot: HackerEmbassyBot, msg: Message, username: string) {
        username = username.replace("@", "");
        const eventDate = new Date();

        const gotIn = StatusHandlers.LetIn(username, eventDate, true);

        let message: string;

        if (gotIn) {
            message = t("status.inforce.gotin", {
                memberusername: helpers.formatUsername(msg.from?.username, bot.context(msg).mode),
                username: helpers.formatUsername(username, bot.context(msg).mode),
            });

            bot.CustomEmitter.emit(BotCustomEvent.statusLive);
        } else {
            message = t("status.inforce.notready");
        }

        await bot.sendMessageExt(msg.chat.id, message, msg);
    }

    static async outForceHandler(bot: HackerEmbassyBot, msg: Message, username: string) {
        const eventDate = new Date();
        username = username.replace("@", "");
        const gotOut = StatusHandlers.LetOut(username, eventDate, true);

        let message: string;

        if (gotOut) {
            message = t("status.outforce.gotout", {
                memberusername: helpers.formatUsername(msg.from?.username, bot.context(msg).mode),
                username: helpers.formatUsername(username, bot.context(msg).mode),
            });

            bot.CustomEmitter.emit(BotCustomEvent.statusLive);
        } else {
            message = t("status.outforce.shouldnot");
        }

        await bot.sendMessageExt(msg.chat.id, message, msg);
    }

    static LetIn(username: string, date: Date, force = false) {
        // check that space is open
        const state = StatusRepository.getSpaceLastState();

        if (!state?.open && !helpers.hasRole(username, "member") && !force) return false;

        const userstate = {
            id: 0,
            status: UserStateType.Inside,
            date: date,
            username: username,
            type: force ? UserStateChangeType.Force : UserStateChangeType.Manual,
            note: null,
        };

        StatusRepository.pushPeopleState(userstate);

        return true;
    }

    static LetOut(username: string, date: Date, force = false) {
        const userstate = {
            id: 0,
            status: UserStateType.Outside,
            date: date,
            username: username,
            type: force ? UserStateChangeType.Force : UserStateChangeType.Manual,
            note: null,
        };

        StatusRepository.pushPeopleState(userstate);

        return true;
    }

    static setGoingState(usernameOrFirstname: string, isGoing: boolean, note: string | undefined = undefined) {
        const eventDate = new Date();

        const userstate = {
            id: 0,
            status: isGoing ? UserStateType.Going : UserStateType.Outside,
            date: eventDate,
            username: usernameOrFirstname,
            type: UserStateChangeType.Manual,
            note: note ?? null,
        };

        StatusRepository.pushPeopleState(userstate);
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
            [InlineButton(t("status.buttons.andgoing"), "going"), InlineButton(t("status.buttons.whoelse"), "status")],
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

            const insideusernames = findRecentStates(StatusRepository.getAllUserStates() ?? [])
                .filter(filterPeopleInside)
                .map(us => us.username);
            const autousers = UsersRepository.getUsers().filter(u => u.autoinside && u.mac);
            const selectedautousers = isIn
                ? autousers.filter(u => u.username && !insideusernames.includes(u.username))
                : autousers.filter(u => u.username && insideusernames.includes(u.username));

            StatusHandlers.isStatusError = false;

            for (const user of selectedautousers) {
                const hasDeviceInside = user.mac ? isMacInside(user.mac, devices) : false;
                if (isIn ? hasDeviceInside : !hasDeviceInside) {
                    user.username &&
                        StatusRepository.pushPeopleState({
                            id: 0,
                            status: isIn ? UserStateType.Inside : UserStateType.Outside,
                            date: new Date(),
                            username: user.username,
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

    static async profileHandler(bot: HackerEmbassyBot, msg: Message, username: Optional<string> = undefined) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        const selectedUsername = (username ?? msg.from?.username)?.replace("@", "");
        const userStates = selectedUsername ? StatusRepository.getUserStates(selectedUsername) : [];
        const donations = selectedUsername ? fundsRepository.getFundDonationsOf(selectedUsername) : [];
        const donationList = donations ? TextGenerators.generateFundDonationsList(donations) : "";
        const totalDonated = donations ? await sumDonations(donations) : 0;

        const { days, hours, minutes } = getUserTimeDescriptor(userStates);

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

        const { days, hours, minutes } = getUserTimeDescriptor(userStates);
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

        const allUserStates = StatusRepository.getAllUserStates();

        const userTimes = allUserStates ? getAllUsersTimes(allUserStates, fromDate, toDate) : [];
        const shouldMentionPeriod = Boolean(fromDateString || toDateString);
        const dateBoundaries = { from: toDateObject(fromDate), to: toDateObject(toDate) };

        if (userTimes.length === 0) {
            await bot.sendMessageExt(msg.chat.id, t("status.stats.nousertimes"), msg);
            return;
        }

        const statsText = TextGenerators.getStatsText(userTimes, dateBoundaries, shouldMentionPeriod);
        const statsDonut = await createUserStatsDonut(userTimes, dateBoundaries);

        await bot.sendLongMessage(msg.chat.id, statsText, msg);
        await bot.sendPhotoExt(msg.chat.id, statsDonut, msg);
    }
}
