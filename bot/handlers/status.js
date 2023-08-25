const StatusRepository = require("../../repositories/statusRepository");
const UsersRepository = require("../../repositories/usersRepository");
const TextGenerators = require("../../services/textGenerators");
const UsersHelper = require("../../services/usersHelper");
const logger = require("../../services/logger");
const {
    openSpace,
    closeSpace,
    isMacInside,
    getUserTimeDescriptor,
    getAllUsersTimes,
    filterPeopleInside,
    filterPeopleGoing,
    evictPeople,
    findRecentStates,
} = require("../../services/statusHelper");

const config = require("config");
const embassyApiConfig = config.get("embassy-api");
const botConfig = config.get("bot");
const statsStartDateString = "2023-01-01";

const t = require("../../services/localization");
const { toDateObject, getMonthBoundaries } = require("../../utils/date");

const { isEmoji } = require("../../utils/text");
const { createUserStatsDonut } = require("../../services/export");
const statusRepository = require("../../repositories/statusRepository");

// eslint-disable-next-line no-unused-vars
const { HackerEmbassyBot } = require("../HackerEmbassyBot");
// eslint-disable-next-line no-unused-vars
const TelegramBot = require("node-telegram-bot-api");
const { fetchWithTimeout } = require("../../utils/network");

class StatusHandlers {
    static isStatusError = false;

    static setmacHandler(bot, msg, cmd) {
        let message = t("status.mac.fail");
        let username = msg.from.username;
        if (!cmd || cmd === "help") {
            message = t("status.mac.help");
        } else if (cmd && UsersRepository.testMACs(cmd) && UsersRepository.setMACs(username, cmd)) {
            message = t("status.mac.set", { cmd, username: UsersHelper.formatUsername(username, bot.context.mode) });
        } else if (cmd === "remove") {
            UsersRepository.setMACs(username, null);
            UsersRepository.setAutoinside(username, false);
            message = t("status.mac.removed", { username: UsersHelper.formatUsername(username, bot.context.mode) });
        } else if (cmd === "status") {
            let usermac = UsersRepository.getUserByName(username)?.mac;
            if (usermac)
                message = t("status.mac.isset", { username: UsersHelper.formatUsername(username, bot.context.mode), usermac });
            else message = t("status.mac.isnotset", { username: UsersHelper.formatUsername(username, bot.context.mode) });
        }

        bot.sendMessage(msg.chat.id, message);
    }

    static autoinsideHandler(bot, msg, cmd) {
        let message = t("status.autoinside.fail");
        let username = msg.from.username;
        let user = UsersRepository.getUserByName(username);
        let usermac = user?.mac;
        let userautoinside = user?.autoinside;

        if (!cmd || cmd === "help") {
            message = t("status.autoinside.help", { timeout: botConfig.timeouts.out / 60000 });
        } else if (cmd === "enable") {
            if (!usermac) message = t("status.autoinside.nomac");
            else if (UsersRepository.setAutoinside(username, true))
                message = t("status.autoinside.set", {
                    usermac,
                    username: UsersHelper.formatUsername(username, bot.context.mode),
                });
        } else if (cmd === "disable") {
            UsersRepository.setAutoinside(username, false);
            message = t("status.autoinside.removed", { username: UsersHelper.formatUsername(username, bot.context.mode) });
        } else if (cmd === "status") {
            if (userautoinside)
                message = t("status.autoinside.isset", {
                    usermac,
                    username: UsersHelper.formatUsername(username, bot.context.mode),
                });
            else message = t("status.autoinside.isnotset", { username: UsersHelper.formatUsername(username, bot.context.mode) });
        }

        bot.sendMessage(msg.chat.id, message);
    }

    static statusHandler = async (bot, msg, edit = false) => {
        bot.sendChatAction(msg.chat.id, "typing");
        const state = StatusRepository.getSpaceLastState();

        if (!state) {
            bot.sendMessage(msg.chat.id, t("status.status.undefined"));
            return;
        }

        const recentUserStates = findRecentStates(StatusRepository.getAllUserStates());
        const inside = recentUserStates.filter(filterPeopleInside);
        const going = recentUserStates.filter(filterPeopleGoing);

        let climateInfo = null;
        try {
            climateInfo = await (await fetchWithTimeout(`${embassyApiConfig.host}:${embassyApiConfig.port}/climate`))?.json();
        } catch (error) {
            logger.error(error);
        }

        const withSecretData = msg.chat.id === botConfig.chats.horny;

        let statusMessage = TextGenerators.getStatusMessage(state, inside, going, climateInfo, bot.context.mode, withSecretData);

        if (StatusHandlers.isStatusError) statusMessage = t("status.status.noconnection", { statusMessage });

        let inlineKeyboard = state.open
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

        if (edit) {
            try {
                await bot.editMessageText(statusMessage, {
                    chat_id: msg.chat.id,
                    message_id: msg.message_id,
                    reply_markup: {
                        inline_keyboard: inlineKeyboard,
                    },
                });
            } catch {
                // Message was not modified
            }
        } else {
            await bot.sendMessage(msg.chat.id, statusMessage, {
                reply_markup: {
                    inline_keyboard: inlineKeyboard,
                },
            });
        }
    };

    static openHandler = async (bot, msg) => {
        if (!UsersHelper.hasRole(msg.from.username, "member")) return;

        openSpace(msg.from.username, { checkOpener: true });

        let inlineKeyboard = [
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

        await bot.sendMessage(
            msg.chat.id,
            t("status.open", { username: UsersHelper.formatUsername(msg.from.username, bot.context.mode) }),
            {
                reply_markup: {
                    inline_keyboard: inlineKeyboard,
                },
            }
        );
    };

    static closeHandler = async (bot, msg) => {
        if (!UsersHelper.hasRole(msg.from.username, "member")) return;

        closeSpace(msg.from.username, { evict: true });

        let inlineKeyboard = [
            [
                {
                    text: t("status.buttons.reopen"),
                    callback_data: JSON.stringify({ command: "/open" }),
                },
            ],
        ];

        await bot.sendMessage(
            msg.chat.id,
            t("status.close", { username: UsersHelper.formatUsername(msg.from.username, bot.context.mode) }),
            {
                reply_markup: {
                    inline_keyboard: inlineKeyboard,
                },
            }
        );
    };

    static evictHandler = async (bot, msg) => {
        if (!UsersHelper.hasRole(msg.from.username, "member")) return;

        evictPeople(findRecentStates(statusRepository.getAllUserStates()).filter(filterPeopleInside));

        await bot.sendMessage(msg.chat.id, t("status.evict"));
    };

    static inHandler = async (bot, msg) => {
        let eventDate = new Date();
        let username = msg.from.username ?? msg.from.first_name;
        let gotIn = this.LetIn(username, eventDate);
        let message = t("status.in.gotin", { username: UsersHelper.formatUsername(username, bot.context.mode) });

        if (!gotIn) {
            message = t("status.in.notready");
        }

        let inlineKeyboard = gotIn
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

        await bot.sendMessage(msg.chat.id, message, {
            reply_markup: {
                inline_keyboard: inlineKeyboard,
            },
        });
    };

    static outHandler = async (bot, msg) => {
        let eventDate = new Date();
        let gotOut = this.LetOut(msg.from.username, eventDate);
        let message = t("status.out.gotout", { username: UsersHelper.formatUsername(msg.from.username, bot.context.mode) });

        if (!gotOut) {
            message = t("status.out.shouldnot");
        }

        let inlineKeyboard = gotOut
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

        await bot.sendMessage(msg.chat.id, message, {
            reply_markup: {
                inline_keyboard: inlineKeyboard,
            },
        });
    };

    static inForceHandler = async (bot, msg, username) => {
        if (!UsersHelper.hasRole(msg.from.username, "member")) return;
        username = username.replace("@", "");
        let eventDate = new Date();

        let gotIn = this.LetIn(username, eventDate, true);

        let message = t("status.inforce.gotin", {
            memberusername: UsersHelper.formatUsername(msg.from.username, bot.context.mode),
            username: UsersHelper.formatUsername(username, bot.context.mode),
        });

        if (!gotIn) {
            message = t("status.inforce.notready");
        }

        await bot.sendMessage(msg.chat.id, message);
    };

    static outForceHandler = async (bot, msg, username) => {
        if (!UsersHelper.hasRole(msg.from.username, "member")) return;
        let eventDate = new Date();
        username = username.replace("@", "");
        let gotOut = this.LetOut(username, eventDate, true);

        let message = t("status.outforce.gotout", {
            memberusername: UsersHelper.formatUsername(msg.from.username, bot.context.mode),
            username: UsersHelper.formatUsername(username, bot.context.mode),
        });

        if (!gotOut) {
            message = t("status.outforce.shouldnot");
        }

        await bot.sendMessage(msg.chat.id, message);
    };

    static LetIn(username, date, force = false) {
        // check that space is open
        let state = StatusRepository.getSpaceLastState();

        if (!state?.open && !UsersHelper.hasRole(username, "member") && !force) return false;

        let userstate = {
            id: 0,
            status: StatusRepository.UserStatusType.Inside,
            date: date,
            username: username,
            type: force ? StatusRepository.ChangeType.Force : StatusRepository.ChangeType.Manual,
            note: null,
        };

        StatusRepository.pushPeopleState(userstate);

        return true;
    }

    static LetOut(username, date, force = false) {
        let state = StatusRepository.getSpaceLastState();

        if (!state?.open && !UsersHelper.hasRole(username, "member") && !force) return false;

        let userstate = {
            id: 0,
            status: StatusRepository.UserStatusType.Outside,
            date: date,
            username: username,
            type: force ? StatusRepository.ChangeType.Force : StatusRepository.ChangeType.Manual,
            note: null,
        };

        StatusRepository.pushPeopleState(userstate);

        return true;
    }

    static goingHandler = async (bot, msg, note) => {
        let username = msg.from.username.replace("@", "");
        let eventDate = new Date();

        let userstate = {
            id: 0,
            status: StatusRepository.UserStatusType.Going,
            date: eventDate,
            username: username,
            type: StatusRepository.ChangeType.Manual,
            note,
        };

        StatusRepository.pushPeopleState(userstate);

        let message = t("status.going", { username: UsersHelper.formatUsername(msg.from.username, bot.context.mode), note });

        let inlineKeyboard = [
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

        await bot.sendMessage(msg.chat.id, message, {
            reply_markup: {
                inline_keyboard: inlineKeyboard,
            },
        });
    };

    static notGoingHandler = async (bot, msg) => {
        let username = msg.from.username.replace("@", "");
        let eventDate = new Date();

        let userstate = {
            id: 0,
            status: StatusRepository.UserStatusType.Outside,
            date: eventDate,
            username: username,
            type: StatusRepository.ChangeType.Manual,
            note: null,
        };

        StatusRepository.pushPeopleState(userstate);

        let message = t("status.notgoing", { username: UsersHelper.formatUsername(msg.from.username, bot.context.mode) });

        await bot.sendMessage(msg.chat.id, message);
    };

    static async setemojiHandler(bot, msg, emoji) {
        if (!UsersHelper.hasRole(msg.from.username, "member")) return;

        let message = t("status.emoji.fail");
        let username = msg.from.username;
        if (!emoji || emoji === "help") {
            message = t("status.emoji.help");
        } else if (emoji && isEmoji(emoji) && UsersRepository.setEmoji(username, emoji)) {
            message = t("status.emoji.set", { emoji, username: UsersHelper.formatUsername(username, bot.context.mode) });
        } else if (emoji === "remove") {
            UsersRepository.setEmoji(username, null);
            message = t("status.emoji.removed", { username: UsersHelper.formatUsername(username, bot.context.mode) });
        } else if (emoji === "status") {
            let emoji = UsersRepository.getUserByName(username)?.emoji;

            if (emoji)
                message = t("status.emoji.isset", { emoji, username: UsersHelper.formatUsername(username, bot.context.mode) });
            else message = t("status.emoji.isnotset", { username: UsersHelper.formatUsername(username, bot.context.mode) });
        }

        await bot.sendMessage(msg.chat.id, message);
    }

    /**
     * @param {boolean} isIn
     * @returns {Promise<void>}
     */
    static async autoinout(isIn) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            let devices = await (
                await fetch(`${embassyApiConfig.host}:${embassyApiConfig.port}/${embassyApiConfig.devicesCheckingPath}`, {
                    signal: controller.signal,
                })
            )?.json();
            clearTimeout(timeoutId);

            let insideusernames = findRecentStates(StatusRepository.getAllUserStates())
                .filter(filterPeopleInside)
                .filter(filterPeopleInside)
                ?.map(us => us.username);
            let autousers = UsersRepository.getUsers()?.filter(u => u.autoinside && u.mac);
            let selectedautousers = isIn
                ? autousers.filter(u => !insideusernames.includes(u.username))
                : autousers.filter(u => insideusernames.includes(u.username));

            this.isStatusError = false;

            for (const user of selectedautousers) {
                let hasDeviceInside = isMacInside(user.mac, devices);
                if (isIn ? hasDeviceInside : !hasDeviceInside) {
                    StatusRepository.pushPeopleState({
                        id: 0,
                        status: isIn ? StatusRepository.UserStatusType.Inside : StatusRepository.UserStatusType.Outside,
                        date: new Date(),
                        username: user.username,
                        type: StatusRepository.ChangeType.Auto,
                        note: null,
                    });

                    logger.info(`User ${user.username} automatically ${isIn ? "got in" : "got out"}`);
                }
            }
        } catch (error) {
            this.isStatusError = true;
            logger.error(error);
        }
    }

    static statsOfHandler = async (bot, msg, username) => {
        bot.sendChatAction(msg.chat.id, "typing");

        const selectedUsername = username ?? msg.from.username;
        const userStates = statusRepository.getUserStates(selectedUsername);

        const { days, hours, minutes } = getUserTimeDescriptor(userStates);
        await bot.sendMessage(
            msg.chat.id,
            `${t("status.statsof", {
                username: UsersHelper.formatUsername(selectedUsername, bot.context.mode),
            })}: ${days}d, ${hours}h, ${minutes}m\n\n${t("status.stats.tryautoinside")}`
        );
    };

    static statsMonthHandler = async (bot, msg, month) => {
        bot.sendChatAction(msg.chat.id, "typing");

        const currentDate = new Date();
        let resultDate = new Date();

        if (month !== undefined) {
            if (month > currentDate.getMonth()) {
                resultDate.setFullYear(currentDate.getFullYear() - 1);
            }
            resultDate.setMonth(month);
        }

        const { startMonthDate, endMonthDate } = getMonthBoundaries(resultDate);

        return await this.statsHandler(bot, msg, startMonthDate.toDateString(), endMonthDate.toDateString());
    };

    /**
     * @param {HackerEmbassyBot} bot
     * @param {TelegramBot.Message} msg
     * @param {string} fromDateString
     * @param {string} toDateString
     */
    static async statsHandler(bot, msg, fromDateString, toDateString) {
        bot.sendChatAction(msg.chat.id, "typing");

        const fromDate = new Date(fromDateString ?? statsStartDateString);
        const toDate = toDateString ? new Date(toDateString) : new Date();

        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
            await bot.sendMessage(msg.chat.id, t("status.stats.invaliddates"));
            return;
        }

        const allUserStates = StatusRepository.getAllUserStates();
        const userTimes = getAllUsersTimes(allUserStates, fromDate, toDate);
        const shouldMentionPeriod = Boolean(fromDateString || toDateString);
        const dateBoundaries = { from: toDateObject(fromDate), to: toDateObject(toDate) };

        if (userTimes.length === 0) {
            return await bot.sendMessage(msg.chat.id, t("status.stats.nousertimes"));
        }

        const statsText = TextGenerators.getStatsText(userTimes, dateBoundaries, shouldMentionPeriod);
        const statsDonut = await createUserStatsDonut(userTimes, dateBoundaries);

        await bot.sendMessage(msg.chat.id, statsText);
        await bot.sendPhoto(msg.chat.id, statsDonut);
    }
}

module.exports = StatusHandlers;
