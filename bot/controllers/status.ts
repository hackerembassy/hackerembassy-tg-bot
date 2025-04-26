import config from "config";

import TelegramBot, { InlineKeyboardButton, Message } from "node-telegram-bot-api";

import { BotConfig } from "@config";

import { State, StateEx, User } from "data/models";
import { UserStateChangeType, AutoInsideMode } from "data/types";

import UsersRepository from "@repositories/users";
import fundsRepository, { COSTS_PREFIX } from "@repositories/funds";

import { DefaultCurrency, sumDonations } from "@services/funds/currency";
import embassyService, { EmbassyLinkMacUrl } from "@services/embassy/embassy";
import { createUserStatsDonut } from "@services/funds/export";
import * as ExportHelper from "@services/funds/export";
import { SpaceClimate } from "@services/embassy/hass";
import logger from "@services/common/logger";
import { openAI } from "@services/external/neural";
import { getTodayEventsCached, HSEvent } from "@services/external/googleCalendar";
import { spaceService } from "@services/domain/space";
import { userService } from "@services/domain/user";

import { sleep } from "@utils/common";
import { DURATION_STRING_REGEX, getMonthBoundaries, toDateObject, tryDurationStringToMs } from "@utils/date";
import { isEmoji, REPLACE_MARKER } from "@utils/text";
import { FeatureFlag, Route } from "@hackembot/core/decorators";
import { Accountants, Admins, Members, TrustedMembers } from "@hackembot/core/constants";

import HackerEmbassyBot, { PUBLIC_CHATS } from "../core/classes/HackerEmbassyBot";
import { AnnoyingInlineButton, ButtonFlags, InlineButton, InlineDeepLinkButton, InlineLinkButton } from "../core/inlineButtons";
import t, { SupportedLanguage } from "../core/localization";
import { BotCustomEvent, BotController, BotMessageContextMode } from "../core/types";
import * as helpers from "../core/helpers";
import * as TextGenerators from "../text";
import { OptionalParam } from "../core/helpers";

const botConfig = config.get<BotConfig>("bot");

export default class StatusController implements BotController {
    static isStatusError = false;

    @Route(["mac", "setmac", "mymac"], OptionalParam(/(\S*)(?: (.+))?/), match => [match[1], match[2]])
    static async macHandler(bot: HackerEmbassyBot, msg: Message, cmd: string, mac?: string) {
        const user = bot.context(msg).user;
        const userLink = helpers.userLink(user);

        let message = t("status.mac.fail");
        let inline_keyboard: InlineKeyboardButton[][] = [];

        if (!cmd || cmd === "help" || cmd === "status") {
            const usermacs = userService
                .getUserMacs(user)
                .map(ud => ud.mac)
                .join(",");
            message = t("status.mac.help", { usermacs: usermacs.length > 0 ? usermacs : "none" });
            inline_keyboard = [[InlineLinkButton(t("status.mac.buttons.detect"), EmbassyLinkMacUrl)]];
        } else if (cmd === "clear") {
            userService.removeUserMacs(user);
            message = t("status.mac.cleared", { username: userLink });
        } else if (cmd === "add" && mac) {
            const macToAdd = mac.trim().replaceAll("-", ":");
            const success = userService.addUserMac(user, macToAdd);

            if (success) {
                message = t("status.mac.set", { mac: macToAdd, username: userLink });
                inline_keyboard = [
                    [
                        AnnoyingInlineButton(bot, msg, t("status.mac.buttons.autoinside"), "autoinside", ButtonFlags.Simple, {
                            params: "enable",
                        }),
                    ],
                ];
            }
        } else if (cmd === "remove" && mac) {
            const macToRemove = mac.trim().replaceAll("-", ":");
            const success = userService.removeUserMac(user, macToRemove);

            if (success) message = t("status.mac.removed", { mac: macToRemove, username: userLink });
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
            [AnnoyingInlineButton(bot, msg, t("status.autoinside.buttons.mac"), "mac", ButtonFlags.Simple)],
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

    @Route(["autoinside"], OptionalParam(/(.*\S)/), match => [match[1]])
    @FeatureFlag("autoinside")
    static async autoinsideHandler(bot: HackerEmbassyBot, msg: Message, cmd: string) {
        const mode = bot.context(msg).mode;
        const user = bot.context(msg).user;
        const userLink = helpers.userLink(user);
        const userMacsString = userService
            .getUserMacs(user)
            .map(ud => ud.mac)
            .join(",");

        let message = t("status.autoinside.fail");
        let inline_keyboard: InlineKeyboardButton[][] = [];

        try {
            switch (cmd) {
                case "enable":
                case "ghost":
                    if (userMacsString.length === 0) {
                        message = t("status.autoinside.nomac");
                    } else {
                        const mode = cmd === "ghost" ? AutoInsideMode.Ghost : AutoInsideMode.Enabled;
                        UsersRepository.updateUser(user.userid, { autoinside: mode });
                        message = TextGenerators.getAutoinsideMessageStatus(mode as AutoInsideMode, userMacsString, userLink);
                    }
                    break;
                case "disable":
                    UsersRepository.updateUser(user.userid, { autoinside: AutoInsideMode.Disabled });
                    message = t("status.autoinside.removed", { username: userLink });
                    break;
                case "status":
                    message = TextGenerators.getAutoinsideMessageStatus(
                        user.autoinside as AutoInsideMode,
                        userMacsString,
                        userLink
                    );
                    break;
                case "help":
                default:
                    inline_keyboard = StatusController.getAutoInsideKeyboard(bot, msg, mode.secret);

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
        mode: BotMessageContextMode,
        short: boolean,
        todayEvents: Nullable<HSEvent[]> = null,
        climateInfo: Nullable<SpaceClimate> = null,
        withSecretData: boolean = false
    ) {
        const inside = userService.getPeopleInside(mode.secret);
        const going = userService.getPeopleGoing();

        let statusMessage = TextGenerators.getStatusMessage(state, inside, going, todayEvents, climateInfo, {
            short,
            withSecrets: withSecretData,
            isApi: false,
        });

        if (StatusController.isStatusError)
            statusMessage = short ? `📵 ${statusMessage}` : t("status.status.noconnection", { statusMessage });

        return statusMessage;
    }

    private static async queryClimate() {
        try {
            const clientResponse = await embassyService.getSpaceClimate();
            return clientResponse;
        } catch (error) {
            logger.error(error);
            return null;
        }
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
        const state = spaceService.getState();

        const climateInfo: Nullable<SpaceClimate> = botConfig.features.embassy ? await StatusController.queryClimate() : null;
        const todayEvents = botConfig.features.calendar ? await getTodayEventsCached() : null;

        bot.context(resultMessage).language = language;

        const statusMessage = StatusController.getStatusMessage(
            state,
            mode,
            short,
            todayEvents,
            climateInfo,
            resultMessage.chat.id === botConfig.chats.horny
        );
        const inline_keyboard = StatusController.getStatusInlineKeyboard(bot, resultMessage, state, short);

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

    @Route(["livestatus", "live"], null, null, Members)
    static async liveStatusShortcutHandler(bot: HackerEmbassyBot, msg: Message) {
        const mode = bot.context(msg).mode;
        mode.live = true;
        mode.pin = true;

        await StatusController.statusHandler(bot, msg, true);
    }

    @Route(["status", "s"], OptionalParam(/(short)/), match => [match[1] === "short"])
    @Route(["shortstatus", "statusshort", "shs"], null, () => [true])
    static async statusHandler(bot: HackerEmbassyBot, msg: Message, short: boolean = false) {
        const context = bot.context(msg);
        if (!context.isEditing) bot.sendChatAction(msg.chat.id, "typing", msg);
        const mode = context.mode;
        const language = context.language;

        const state = spaceService.getState();
        const todayEvents = botConfig.features.calendar ? await getTodayEventsCached() : null;

        const statusMessage = StatusController.getStatusMessage(state, mode, short, todayEvents);
        const inline_keyboard = StatusController.getStatusInlineKeyboard(bot, msg, state, short);

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

        if (botConfig.features.embassy) {
            const climateInfo: Nullable<SpaceClimate> = await StatusController.queryClimate();

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
        }

        if (mode.live) {
            bot.addLiveMessage(
                resultMessage,
                BotCustomEvent.statusLive,
                () => StatusController.liveStatusHandler(bot, resultMessage, short, mode, language),
                {
                    functionName: StatusController.liveStatusHandler.name,
                    module: __filename,
                    params: [resultMessage, short, mode, language],
                }
            );
        }
    }

    @Route(["shouldigo", "shouldvisit", "shouldgo", "should"])
    @FeatureFlag("ai")
    static async shouldIGoHandler(bot: HackerEmbassyBot, msg: Message) {
        if (!PUBLIC_CHATS.includes(msg.chat.id)) {
            await bot.sendMessageExt(msg.chat.id, t("general.chatnotallowed"), msg);
            return;
        }

        try {
            bot.sendChatAction(msg.chat.id, "typing", msg);

            const state = spaceService.getState();
            const inside = userService.getPeopleInside();
            const going = userService.getPeopleGoing();

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

    @Route(["open", "o"], null, null, Members)
    static async openHandler(bot: HackerEmbassyBot, msg: Message) {
        const opener = bot.context(msg).user;

        spaceService.openSpace(opener, { checkOpener: false });
        bot.customEmitter.emit(BotCustomEvent.statusLive);

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

    @Route(["close", "c"], null, null, Members)
    static async closeHandler(bot: HackerEmbassyBot, msg: Message) {
        const closer = bot.context(msg).user;

        spaceService.closeSpace(closer);
        userService.evictPeople();

        bot.customEmitter.emit(BotCustomEvent.statusLive);

        const inline_keyboard = [[InlineButton(t("status.buttons.reopen"), "open")]];

        await bot.sendMessageExt(msg.chat.id, t("status.close", { username: helpers.userLink(closer) }), msg, {
            reply_markup: {
                inline_keyboard,
            },
        });
    }

    @Route(["evict", "outforceall"], null, null, Members)
    static async evictHandler(bot: HackerEmbassyBot, msg: Message) {
        userService.evictPeople();
        bot.customEmitter.emit(BotCustomEvent.statusLive);

        await bot.sendMessageExt(msg.chat.id, t("status.evict"), msg);
    }

    @Route(["in", "iaminside"], OptionalParam(RegExp(`(?:for )?(${DURATION_STRING_REGEX.source})`)), match => [false, match[1]])
    @Route(
        ["inghost", "ghost"],
        OptionalParam(RegExp(`(?:for )?(${DURATION_STRING_REGEX.source})`)),
        match => [true, match[1]],
        TrustedMembers
    )
    @Route(
        ["inforce", "inf", "goin"],
        RegExp(`(\\S+)(?: (?:for )?(${DURATION_STRING_REGEX.source}))?`),
        match => [false, match[2], match[1]],
        TrustedMembers
    )
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
        const gotIn = userService.letIn(
            target,
            force ? UserStateChangeType.Force : UserStateChangeType.Manual,
            eventDate,
            until,
            ghost
        );

        if (gotIn) bot.customEmitter.emit(BotCustomEvent.statusLive);

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

    @Route(["outforce", "outf", "gohome"], /(\S+)/, match => [match[1]], TrustedMembers)
    @Route(["out", "iamleaving"])
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

        const gotOut = userService.letOut(target, force ? UserStateChangeType.Force : UserStateChangeType.Manual, eventDate);
        let message: string;

        if (gotOut) {
            message = t(force ? "status.outforce.gotout" : "status.out.gotout", {
                username: helpers.userLink(target),
                memberusername: force ? helpers.userLink(sender) : undefined,
            });
            bot.customEmitter.emit(BotCustomEvent.statusLive);
        } else {
            message = t(force ? "status.outforce.shouldnot" : "status.out.shouldnot");
        }

        const inline_keyboard = gotOut
            ? [
                  [InlineButton(t("status.buttons.outandout"), "out"), InlineButton(t("status.buttons.outandin"), "in")],
                  [
                      msg.chat.id === botConfig.chats.main
                          ? InlineDeepLinkButton(t("status.buttons.whoinside"), bot.name, "status")
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

    @Route(["going", "coming", "cuming", "g"], OptionalParam(/(.*)/), match => [match[1]])
    static async goingHandler(bot: HackerEmbassyBot, msg: Message, note?: string) {
        const sender = bot.context(msg).user;

        userService.setGoingState(sender, true, note);
        bot.customEmitter.emit(BotCustomEvent.statusLive);

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

    @Route(["notgoing", "notcoming", "notcuming", "ng"], OptionalParam(/(.*)/), match => [match[1]])
    static async notGoingHandler(bot: HackerEmbassyBot, msg: Message, note?: string) {
        const sender = bot.context(msg).user;

        userService.setGoingState(sender, false, note);
        bot.customEmitter.emit(BotCustomEvent.statusLive);

        const message = t("status.notgoing", {
            username: helpers.userLink(sender),
            note,
        });

        await bot.sendMessageExt(msg.chat.id, message, msg);
    }

    @Route(["setemoji", "emoji", "myemoji"], OptionalParam(/(.*)/), match => [match[1]], TrustedMembers)
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

    @Route(["detected"], null, null, Admins)
    static async detectedDevicesHandler(bot: HackerEmbassyBot, msg: Message) {
        const detectedDevices = await embassyService.fetchMacsInside();
        const userdevices = userService.getDevicesWithUsers();

        const devicesWithOwners = detectedDevices.map(mac => {
            const user = userdevices.find(ud => ud.mac === mac)?.user;
            return user ? `${mac} - @${user.username ?? user.first_name}` : mac;
        });

        bot.sendMessageExt(msg.chat.id, "#*Detected devices:#*\n" + devicesWithOwners.join("\n"), msg);
    }

    static async autoinout(bot: HackerEmbassyBot, checkInside: boolean): Promise<void> {
        try {
            StatusController.isStatusError = false;

            // Request devices and users
            const macsInsideRequest = embassyService.fetchMacsInside();
            const devicesWithAutousers = userService.getDevicesWithAutousers();
            const insideUserStates = userService.getPeopleInside(true);

            // Select users to update
            const insideUserStatesMap = new Map(insideUserStates.map(u => [u.user_id, u]));
            const userStateFilteredDevices = checkInside
                ? devicesWithAutousers.filter(ud => !insideUserStatesMap.has(ud.user.userid))
                : devicesWithAutousers.filter(ud => insideUserStatesMap.get(ud.user.userid)?.type === UserStateChangeType.Auto);

            // Get unique users and macs
            const uniqueUsersMap = new Map<number, User>();
            userStateFilteredDevices
                .map(ud => ud.user)
                .forEach(user => !uniqueUsersMap.has(user.userid) && uniqueUsersMap.set(user.userid, user));
            const macUsersMap = new Map(userStateFilteredDevices.map(ud => [ud.mac, uniqueUsersMap.get(ud.user_id)]));

            // Filter users to update
            const usersToUpdateSet = new Set(checkInside ? [] : uniqueUsersMap.values());

            for (const mac of await macsInsideRequest) {
                const macUser = macUsersMap.get(mac);
                if (macUser) checkInside ? usersToUpdateSet.add(macUser) : usersToUpdateSet.delete(macUser);
            }

            // Update user states
            for (const user of usersToUpdateSet.values()) {
                const success = checkInside
                    ? userService.letIn(
                          user,
                          UserStateChangeType.Auto,
                          new Date(),
                          undefined,
                          user.autoinside === AutoInsideMode.Ghost
                      )
                    : userService.letOut(user, UserStateChangeType.Auto);

                if (success) {
                    logger.info(`User ${user.username} automatically ${checkInside ? "got in" : "got out"}`);
                } else {
                    logger.info(`User ${user.username} could not be ${checkInside ? "let in" : "let out"}`);
                }
            }

            // Notify live status messages
            bot.customEmitter.emit(BotCustomEvent.statusLive);
        } catch (error) {
            StatusController.isStatusError = true;
            logger.error(error);
        }
    }

    static timedOutHandler(bot: HackerEmbassyBot) {
        const currentDate = new Date();
        const timedOutUsers = userService
            .getPeopleInside(true)
            .filter(us => us.until && us.until < currentDate.getTime())
            .map(us => us.user);

        for (const user of timedOutUsers) {
            userService.letOut(user, UserStateChangeType.TimedOut, currentDate);
        }

        if (timedOutUsers.length > 0) bot.customEmitter.emit(BotCustomEvent.statusLive);
    }

    @Route(["profile"], /(\S+)/, match => [match[1]], Accountants)
    @Route(["me"])
    static async profileHandler(bot: HackerEmbassyBot, msg: Message, username?: string): Promise<any> {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        const sender = bot.context(msg).user;
        const target = username ? UsersRepository.getUserByName(username.replace("@", "")) : sender;

        if (!target) return bot.sendMessageExt(msg.chat.id, t("status.profile.notfound"), msg);

        const donations = fundsRepository.getDonationsOf(target.userid, true, true);
        const donationList = donations.length ? TextGenerators.generateFundDonationsList(donations) : "";
        const totalDonated = donations.length ? await sumDonations(donations) : 0;
        const { days, hours, minutes } = userService.getUserTotalTime(target);

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

    @Route(["statsof"], /(\S+)/, match => [match[1]])
    @Route(["mystats"])
    static async statsOfHandler(bot: HackerEmbassyBot, msg: Message, username?: string) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        const sender = bot.context(msg).user;
        const target = username ? (UsersRepository.getUserByName(username.replace("@", "")) ?? sender) : sender;
        const { days, hours, minutes } = userService.getUserTotalTime(target);

        await bot.sendMessageExt(
            msg.chat.id,
            `${t("status.statsof", {
                username: helpers.userLink(target),
            })}: ${days}d, ${hours}h, ${minutes}m\n\n${t("status.stats.tryautoinside")}`,
            msg
        );
    }

    @Route(["month", "statsmonth", "monthstats"])
    @Route(["lastmonth", "statslastmonth", "lastmonthstats"], null, () => [new Date().getMonth() - 1])
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

        await StatusController.statsHandler(bot, msg, startMonthDate.toDateString(), endMonthDate.toDateString());
    }

    @Route(["stats"], OptionalParam(/(?:from (\S+) ?)?(?:to (\S+))?/), match => [match[1], match[2]])
    @Route(["statsall", "allstats"], null, () => [botConfig.launchDate])
    static async statsHandler(bot: HackerEmbassyBot, msg: Message, fromDateString?: string, toDateString?: string): Promise<any> {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        if (!fromDateString && !toDateString) return bot.sendMessageExt(msg.chat.id, t("status.stats.help"), msg);

        const fromDate = new Date(fromDateString ? fromDateString : botConfig.launchDate);
        const toDate = toDateString ? new Date(toDateString) : new Date();
        toDate.setHours(23, 59, 59, 999);

        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime()))
            return bot.sendMessageExt(msg.chat.id, t("status.stats.invaliddates"), msg);

        const userTimes = userService.getAllVisits(fromDate, toDate);
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
