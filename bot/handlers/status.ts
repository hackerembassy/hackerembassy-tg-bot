import config from "config";
import { Message } from "node-telegram-bot-api";

import { BotConfig, EmbassyApiConfig } from "../../config/schema";
import { UserStateChangeType, UserStateType } from "../../models/UserState";
import StatusRepository from "../../repositories/statusRepository";
import UsersRepository from "../../repositories/usersRepository";
import { createUserStatsDonut } from "../../services/export";
import { SpaceClimate } from "../../services/home";
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
import * as UsersHelper from "../../services/usersHelper";
import { getMonthBoundaries, toDateObject } from "../../utils/date";
import { fetchWithTimeout } from "../../utils/network";
import { isEmoji } from "../../utils/text";
import HackerEmbassyBot from "../HackerEmbassyBot";

const embassyApiConfig = config.get("embassy-api") as EmbassyApiConfig;
const botConfig = config.get("bot") as BotConfig;
const statsStartDateString = "2023-01-01";

export default class StatusHandlers {
    static isStatusError = false;

    static async setmacHandler(bot: HackerEmbassyBot, msg: Message, cmd: string) {
        let message = t("status.mac.fail");
        const username = msg.from?.username;
        if (!cmd || cmd === "help") {
            message = t("status.mac.help");
        } else if (cmd && username && UsersRepository.testMACs(cmd) && UsersRepository.setMACs(username, cmd)) {
            message = t("status.mac.set", { cmd, username: UsersHelper.formatUsername(username, bot.context(msg).mode) });
        } else if (cmd === "remove" && username) {
            UsersRepository.setMACs(username, null);
            UsersRepository.setAutoinside(username, false);
            message = t("status.mac.removed", { username: UsersHelper.formatUsername(username, bot.context(msg).mode) });
        } else if (cmd === "status") {
            const usermac = username ? UsersRepository.getUserByName(username)?.mac : undefined;
            if (usermac)
                message = t("status.mac.isset", {
                    username: UsersHelper.formatUsername(username, bot.context(msg).mode),
                    usermac,
                });
            else message = t("status.mac.isnotset", { username: UsersHelper.formatUsername(username, bot.context(msg).mode) });
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
                    username: UsersHelper.formatUsername(username, bot.context(msg).mode),
                });
        } else if (cmd === "disable" && username) {
            UsersRepository.setAutoinside(username, false);
            message = t("status.autoinside.removed", { username: UsersHelper.formatUsername(username, bot.context(msg).mode) });
        } else if (cmd === "status") {
            if (userautoinside)
                message = t("status.autoinside.isset", {
                    usermac,
                    username: UsersHelper.formatUsername(username, bot.context(msg).mode),
                });
            else
                message = t("status.autoinside.isnotset", {
                    username: UsersHelper.formatUsername(username, bot.context(msg).mode),
                });
        }

        await bot.sendMessageExt(msg.chat.id, message, msg);
    }

    static async statusHandler(bot: HackerEmbassyBot, msg: Message) {
        if (!bot.context(msg).isEditing) bot.sendChatAction(msg.chat.id, "typing", msg);
        const state = StatusRepository.getSpaceLastState();

        if (!state) {
            bot.sendMessageExt(msg.chat.id, t("status.status.undefined"), msg);
            return;
        }

        const recentUserStates = findRecentStates(StatusRepository.getAllUserStates() ?? []);
        const inside = recentUserStates.filter(filterPeopleInside);
        const going = recentUserStates.filter(filterPeopleGoing);

        let climateInfo: SpaceClimate | null = null;
        try {
            const response = await fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/climate`);
            climateInfo = await response?.json();
        } catch (error) {
            logger.error(error);
        }

        const withSecretData = msg.chat.id === botConfig.chats.horny;

        let statusMessage = TextGenerators.getStatusMessage(
            state,
            inside,
            going,
            climateInfo,
            bot.context(msg).mode,
            withSecretData
        );

        if (StatusHandlers.isStatusError) statusMessage = t("status.status.noconnection", { statusMessage });

        const inlineKeyboard = state.open
            ? [
                  [
                      {
                          text: t("status.buttons.in"),
                          callback_data: JSON.stringify({ command: "/in" }),
                      },
                      {
                          text: t("status.buttons.out"),
                          callback_data: JSON.stringify({ command: "/out" }),
                      },
                  ],
              ]
            : [];

        inlineKeyboard.push([
            {
                text: t("status.buttons.going"),
                callback_data: JSON.stringify({ command: "/going" }),
            },
            {
                text: t("status.buttons.notgoing"),
                callback_data: JSON.stringify({ command: "/notgoing" }),
            },
        ]);

        inlineKeyboard.push([
            {
                text: t("status.buttons.refresh"),
                callback_data: JSON.stringify({ command: "/ustatus" }),
            },
            {
                text: state.open ? t("status.buttons.close") : t("status.buttons.open"),
                callback_data: state.open ? JSON.stringify({ command: "/close" }) : JSON.stringify({ command: "/open" }),
            },
        ]);

        await bot.sendOrEditMessage(
            msg.chat.id,
            statusMessage,
            msg,
            {
                reply_markup: {
                    inline_keyboard: inlineKeyboard,
                },
            },
            msg.message_id
        );
    }

    static async openHandler(bot: HackerEmbassyBot, msg: Message) {
        openSpace(msg.from?.username, { checkOpener: true });

        const inlineKeyboard = [
            [
                {
                    text: t("status.buttons.in"),
                    callback_data: JSON.stringify({ command: "/in" }),
                },
                {
                    text: t("status.buttons.reclose"),
                    callback_data: JSON.stringify({ command: "/close" }),
                },
            ],
            [
                {
                    text: t("status.buttons.whoinside"),
                    callback_data: JSON.stringify({ command: "/status" }),
                },
            ],
        ];

        await bot.sendMessageExt(
            msg.chat.id,
            t("status.open", { username: UsersHelper.formatUsername(msg.from?.username, bot.context(msg).mode) }),
            msg,
            {
                reply_markup: {
                    inline_keyboard: inlineKeyboard,
                },
            }
        );
    }

    static async closeHandler(bot: HackerEmbassyBot, msg: Message) {
        closeSpace(msg.from?.username, { evict: true });

        const inlineKeyboard = [
            [
                {
                    text: t("status.buttons.reopen"),
                    callback_data: JSON.stringify({ command: "/open" }),
                },
            ],
        ];

        await bot.sendMessageExt(
            msg.chat.id,
            t("status.close", { username: UsersHelper.formatUsername(msg.from?.username, bot.context(msg).mode) }),
            msg,
            {
                reply_markup: {
                    inline_keyboard: inlineKeyboard,
                },
            }
        );
    }

    static async evictHandler(bot: HackerEmbassyBot, msg: Message) {
        evictPeople(findRecentStates(StatusRepository.getAllUserStates() ?? []).filter(filterPeopleInside));

        await bot.sendMessageExt(msg.chat.id, t("status.evict"), msg);
    }

    static async inHandler(bot: HackerEmbassyBot, msg: Message) {
        const eventDate = new Date();
        const usernameOrFirstname = msg.from?.username ?? msg.from?.first_name;
        const gotIn = usernameOrFirstname ? StatusHandlers.LetIn(usernameOrFirstname, eventDate) : false;
        let message = t("status.in.gotin", { username: UsersHelper.formatUsername(usernameOrFirstname, bot.context(msg).mode) });

        if (!gotIn) {
            message = t("status.in.notready");
        }

        const inlineKeyboard = gotIn
            ? [
                  [
                      {
                          text: t("status.buttons.inandin"),
                          callback_data: JSON.stringify({ command: "/in" }),
                      },
                      {
                          text: t("status.buttons.inandout"),
                          callback_data: JSON.stringify({ command: "/out" }),
                      },
                  ],
                  [
                      {
                          text: t("status.buttons.whoinside"),
                          callback_data: JSON.stringify({ command: "/status" }),
                      },
                  ],
              ]
            : [
                  [
                      {
                          text: t("status.buttons.repeat"),
                          callback_data: JSON.stringify({ command: "/in" }),
                      },
                      {
                          text: t("status.buttons.open"),
                          callback_data: JSON.stringify({ command: "/open" }),
                      },
                  ],
              ];

        await bot.sendMessageExt(msg.chat.id, message, msg, {
            reply_markup: {
                inline_keyboard: inlineKeyboard,
            },
        });
    }

    static async outHandler(bot: HackerEmbassyBot, msg: Message) {
        const eventDate = new Date();
        const gotOut = msg.from?.username ? StatusHandlers.LetOut(msg.from.username, eventDate) : false;
        let message = t("status.out.gotout", { username: UsersHelper.formatUsername(msg.from?.username, bot.context(msg).mode) });

        if (!gotOut) {
            message = t("status.out.shouldnot");
        }

        const inlineKeyboard = gotOut
            ? [
                  [
                      {
                          text: t("status.buttons.outandout"),
                          callback_data: JSON.stringify({ command: "/out" }),
                      },
                      {
                          text: t("status.buttons.outandin"),
                          callback_data: JSON.stringify({ command: "/in" }),
                      },
                  ],
                  [
                      {
                          text: t("status.buttons.whoinside"),
                          callback_data: JSON.stringify({ command: "/status" }),
                      },
                  ],
              ]
            : [
                  [
                      {
                          text: t("status.buttons.repeat"),
                          callback_data: JSON.stringify({ command: "/out" }),
                      },
                      {
                          text: t("status.buttons.open"),
                          callback_data: JSON.stringify({ command: "/open" }),
                      },
                  ],
              ];

        await bot.sendMessageExt(msg.chat.id, message, msg, {
            reply_markup: {
                inline_keyboard: inlineKeyboard,
            },
        });
    }

    static async inForceHandler(bot: HackerEmbassyBot, msg: Message, username: string) {
        username = username.replace("@", "");
        const eventDate = new Date();

        const gotIn = StatusHandlers.LetIn(username, eventDate, true);

        let message = t("status.inforce.gotin", {
            memberusername: UsersHelper.formatUsername(msg.from?.username, bot.context(msg).mode),
            username: UsersHelper.formatUsername(username, bot.context(msg).mode),
        });

        if (!gotIn) {
            message = t("status.inforce.notready");
        }

        await bot.sendMessageExt(msg.chat.id, message, msg);
    }

    static async outForceHandler(bot: HackerEmbassyBot, msg: Message, username: string) {
        const eventDate = new Date();
        username = username.replace("@", "");
        const gotOut = StatusHandlers.LetOut(username, eventDate, true);

        let message = t("status.outforce.gotout", {
            memberusername: UsersHelper.formatUsername(msg.from?.username, bot.context(msg).mode),
            username: UsersHelper.formatUsername(username, bot.context(msg).mode),
        });

        if (!gotOut) {
            message = t("status.outforce.shouldnot");
        }

        await bot.sendMessageExt(msg.chat.id, message, msg);
    }

    static async LetIn(username: string, date: Date, force = false) {
        // check that space is open
        const state = StatusRepository.getSpaceLastState();

        if (!state?.open && !UsersHelper.hasRole(username, "member") && !force) return false;

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
        const state = StatusRepository.getSpaceLastState();

        if (!state?.open && !UsersHelper.hasRole(username, "member") && !force) return false;

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

    static async goingHandler(bot: HackerEmbassyBot, msg: Message, note: string | undefined = undefined) {
        const usernameOrFirstname = msg.from?.username?.replace("@", "") ?? msg.from?.first_name;
        // TODO add proper handling of username together with firstname
        if (!usernameOrFirstname) return;

        const eventDate = new Date();

        const userstate = {
            id: 0,
            status: UserStateType.Going,
            date: eventDate,
            username: usernameOrFirstname,
            type: UserStateChangeType.Manual,
            note: note ?? null,
        };

        StatusRepository.pushPeopleState(userstate);

        const message = t("status.going", {
            username: UsersHelper.formatUsername(usernameOrFirstname, bot.context(msg).mode),
            note,
        });

        const inlineKeyboard = [
            [
                {
                    text: t("status.buttons.andgoing"),
                    callback_data: JSON.stringify({ command: "/going" }),
                },
                {
                    text: t("status.buttons.whoelse"),
                    callback_data: JSON.stringify({ command: "/status" }),
                },
            ],
        ];

        await bot.sendMessageExt(msg.chat.id, message, msg, {
            reply_markup: {
                inline_keyboard: inlineKeyboard,
            },
        });
    }

    static async notGoingHandler(bot: HackerEmbassyBot, msg: Message) {
        const usernameOrFirstname = msg.from?.username?.replace("@", "") ?? msg.from?.first_name;
        if (!usernameOrFirstname) return;

        const eventDate = new Date();

        const userstate = {
            id: 0,
            status: UserStateType.Outside,
            date: eventDate,
            username: usernameOrFirstname,
            type: UserStateChangeType.Manual,
            note: null,
        };

        StatusRepository.pushPeopleState(userstate);

        const message = t("status.notgoing", {
            username: UsersHelper.formatUsername(usernameOrFirstname, bot.context(msg).mode),
        });

        await bot.sendMessageExt(msg.chat.id, message, msg);
    }

    static async setemojiHandler(bot: HackerEmbassyBot, msg: Message, emoji: string) {
        let message = t("status.emoji.fail");
        const username = msg.from?.username;
        if (!emoji || emoji === "help" || !username) {
            message = t("status.emoji.help");
        } else if (emoji && isEmoji(emoji) && UsersRepository.setEmoji(username, emoji)) {
            message = t("status.emoji.set", { emoji, username: UsersHelper.formatUsername(username, bot.context(msg).mode) });
        } else if (emoji === "remove") {
            UsersRepository.setEmoji(username, null);
            message = t("status.emoji.removed", { username: UsersHelper.formatUsername(username, bot.context(msg).mode) });
        } else if (emoji === "status") {
            const emoji = UsersRepository.getUserByName(username)?.emoji;

            if (emoji)
                message = t("status.emoji.isset", {
                    emoji,
                    username: UsersHelper.formatUsername(username, bot.context(msg).mode),
                });
            else message = t("status.emoji.isnotset", { username: UsersHelper.formatUsername(username, bot.context(msg).mode) });
        }

        await bot.sendMessageExt(msg.chat.id, message, msg);
    }

    static async autoinout(isIn: boolean): Promise<void> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            const devices = await (
                await fetch(`${embassyApiConfig.host}:${embassyApiConfig.port}/${embassyApiConfig.devicesCheckingPath}`, {
                    signal: controller.signal,
                })
            )?.json();
            clearTimeout(timeoutId);

            const insideusernames = findRecentStates(StatusRepository.getAllUserStates() ?? [])
                .filter(filterPeopleInside)
                .filter(filterPeopleInside)
                ?.map(us => us.username);
            const autousers = UsersRepository.getUsers()?.filter(u => u.autoinside && u.mac) ?? [];
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

                    logger.info(`User ${user.username} automatically ${isIn ? "got in" : "got out"}`);
                }
            }
        } catch (error) {
            StatusHandlers.isStatusError = true;
            logger.error(error);
        }
    }

    static async statsOfHandler(bot: HackerEmbassyBot, msg: Message, username = undefined) {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        const selectedUsername = username ?? msg.from?.username;
        const userStates = selectedUsername ? StatusRepository.getUserStates(selectedUsername) : [];

        const { days, hours, minutes } = getUserTimeDescriptor(userStates);
        await bot.sendMessageExt(
            msg.chat.id,
            `${t("status.statsof", {
                username: UsersHelper.formatUsername(selectedUsername, bot.context(msg).mode),
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

        await this.statsHandler(bot, msg, startMonthDate.toDateString(), endMonthDate.toDateString());
    }

    static async statsHandler(
        bot: HackerEmbassyBot,
        msg: Message,
        fromDateString: string,
        toDateString: string | number | Date
    ): Promise<Message | void> {
        bot.sendChatAction(msg.chat.id, "typing", msg);

        const fromDate = new Date(fromDateString ?? statsStartDateString);
        const toDate = toDateString ? new Date(toDateString) : new Date();

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

        await bot.sendMessageExt(msg.chat.id, statsText, msg);
        await bot.sendPhotoExt(msg.chat.id, statsDonut, msg);
    }
}
