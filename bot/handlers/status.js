const StatusRepository = require("../../repositories/statusRepository");
const UsersRepository = require("../../repositories/usersRepository");
const TextGenerators = require("../../services/textGenerators");
const UsersHelper = require("../../services/usersHelper");
const logger = require("../../services/logger");
const { openSpace, closeSpace, isMacInside } = require("../../services/statusHelper");

const config = require("config");
const embassyApiConfig = config.get("embassy-api");
const botConfig = config.get("bot");

const t = require("../../services/localization");

class StatusHandlers {
    static isStatusError = false;

    static setmacHandler(bot, msg, cmd) {
        let message = t("status.mac.fail");
        let username = msg.from.username;
        if (!cmd || cmd === "help") {
            message = t("status.mac.help");
        } else if (cmd && UsersRepository.testMACs(cmd) && UsersRepository.setMACs(username, cmd)) {
            message = t("status.mac.set", { cmd, username: UsersHelper.formatUsername(username, bot.mode) });
        } else if (cmd === "remove") {
            UsersRepository.setMACs(username, null);
            UsersRepository.setAutoinside(username, false);
            message = t("status.mac.removed", { username: UsersHelper.formatUsername(username, bot.mode) });
        } else if (cmd === "status") {
            let usermac = UsersRepository.getUserByName(username)?.mac;
            if (usermac) message = t("status.mac.isset", { username: UsersHelper.formatUsername(username, bot.mode), usermac });
            else message = t("status.mac.isnotset", { username: UsersHelper.formatUsername(username, bot.mode) });
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
                message = t("status.autoinside.set", { usermac, username: UsersHelper.formatUsername(username, bot.mode) });
        } else if (cmd === "disable") {
            UsersRepository.setAutoinside(username, false);
            message = t("status.autoinside.removed", { username: UsersHelper.formatUsername(username, bot.mode) });
        } else if (cmd === "status") {
            if (userautoinside)
                message = t("status.autoinside.isset", { usermac, username: UsersHelper.formatUsername(username, bot.mode) });
            else message = t("status.autoinside.isnotset", { username: UsersHelper.formatUsername(username, bot.mode) });
        }

        bot.sendMessage(msg.chat.id, message);
    }

    static statusHandler = async (bot, msg, edit = false) => {
        let state = StatusRepository.getSpaceLastState();

        if (!state) {
            bot.sendMessage(msg.chat.id, t("status.status.undefined"));
            return;
        }

        let inside = StatusRepository.getPeopleInside();
        let going = StatusRepository.getPeopleGoing();
        let statusMessage = TextGenerators.getStatusMessage(state, inside, going, bot.mode);

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

    static openHandler = (bot, msg) => {
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

        bot.sendMessage(msg.chat.id, t("status.open", { username: UsersHelper.formatUsername(msg.from.username, bot.mode) }), {
            reply_markup: {
                inline_keyboard: inlineKeyboard,
            },
        });
    };

    static closeHandler = (bot, msg) => {
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

        bot.sendMessage(msg.chat.id, t("status.close", { username: UsersHelper.formatUsername(msg.from.username, bot.mode) }), {
            reply_markup: {
                inline_keyboard: inlineKeyboard,
            },
        });
    };

    static evictHandler = (bot, msg) => {
        if (!UsersHelper.hasRole(msg.from.username, "member")) return;

        StatusRepository.evictPeople();

        bot.sendMessage(msg.chat.id, t("status.evict"));
    };

    static inHandler = (bot, msg) => {
        let eventDate = new Date();
        let username = msg.from.username ?? msg.from.first_name;
        let gotIn = this.LetIn(username, eventDate);
        let message = t("status.in.gotin", { username: UsersHelper.formatUsername(username, bot.mode) });

        if (!gotIn) {
            message = t("status.in.notready");
        }

        let inlineKeyboard = gotIn
            ? [
                  [
                      {
                          text: t("status.buttons.andin"),
                          callback_data: JSON.stringify({ command: "/in" }),
                      },
                      {
                          text: t("status.buttons.andout"),
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

        bot.sendMessage(msg.chat.id, message, {
            reply_markup: {
                inline_keyboard: inlineKeyboard,
            },
        });
    };

    static outHandler = (bot, msg) => {
        let eventDate = new Date();
        let gotOut = this.LetOut(msg.from.username, eventDate);
        let message = t("status.out.gotout", { username: UsersHelper.formatUsername(msg.from.username, bot.mode) });

        if (!gotOut) {
            message = t("status.out.shouldnot");
        }

        let inlineKeyboard = gotOut
            ? [
                  [
                      {
                          text: t("status.buttons.andout"),
                          callback_data: JSON.stringify({ command: "/out" }),
                      },
                      {
                          text: t("status.buttons.andin"),
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

        bot.sendMessage(msg.chat.id, message, {
            reply_markup: {
                inline_keyboard: inlineKeyboard,
            },
        });
    };

    static inForceHandler = (bot, msg, username) => {
        if (!UsersHelper.hasRole(msg.from.username, "member")) return;
        username = username.replace("@", "");
        let eventDate = new Date();

        let gotIn = this.LetIn(username, eventDate, true);

        let message = t("status.inforce.gotin", {
            memberusername: UsersHelper.formatUsername(msg.from.username, bot.mode),
            username: UsersHelper.formatUsername(username, bot.mode),
        });

        if (!gotIn) {
            message = t("status.inforce.notready");
        }
        bot.sendMessage(msg.chat.id, message);
    };

    static outForceHandler = (bot, msg, username) => {
        if (!UsersHelper.hasRole(msg.from.username, "member")) return;
        let eventDate = new Date();
        username = username.replace("@", "");
        let gotOut = this.LetOut(username, eventDate, true);

        let message = t("status.outforce.gotout", {
            memberusername: UsersHelper.formatUsername(msg.from.username, bot.mode),
            username: UsersHelper.formatUsername(username, bot.mode),
        });

        if (!gotOut) {
            message = t("status.outforce.shouldnot");
        }

        bot.sendMessage(msg.chat.id, message);
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
        };

        StatusRepository.pushPeopleState(userstate);

        return true;
    }

    static goingHandler = (bot, msg) => {
        let username = msg.from.username.replace("@", "");
        let eventDate = new Date();

        let userstate = {
            id: 0,
            status: StatusRepository.UserStatusType.Going,
            date: eventDate,
            username: username,
            type: StatusRepository.ChangeType.Manual,
        };

        StatusRepository.pushPeopleState(userstate);

        let message = t("status.going", { username: UsersHelper.formatUsername(msg.from.username, bot.mode) });

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

        bot.sendMessage(msg.chat.id, message, {
            reply_markup: {
                inline_keyboard: inlineKeyboard,
            },
        });
    };

    static notGoingHandler = (bot, msg) => {
        let username = msg.from.username.replace("@", "");
        let eventDate = new Date();

        let userstate = {
            id: 0,
            status: StatusRepository.UserStatusType.Outside,
            date: eventDate,
            username: username,
            type: StatusRepository.ChangeType.Manual,
        };

        StatusRepository.pushPeopleState(userstate);

        let message = t("status.notgoing", { username: UsersHelper.formatUsername(msg.from.username, bot.mode) });

        bot.sendMessage(msg.chat.id, message);
    };

    static setemojiHandler(bot, msg, emoji) {
        if (!UsersHelper.hasRole(msg.from.username, "member")) return;

        let message = t("status.emoji.fail");
        let username = msg.from.username;
        if (!emoji || emoji === "help") {
            message = t("status.emoji.help");
        } else if (emoji && isEmoji(emoji) && UsersRepository.setEmoji(username, emoji)) {
            message = t("status.emoji.set", { emoji, username: UsersHelper.formatUsername(username, bot.mode) });
        } else if (emoji === "remove") {
            UsersRepository.setEmoji(username, null);
            message = t("status.emoji.removed", { username: UsersHelper.formatUsername(username, bot.mode) });
        } else if (emoji === "status") {
            let emoji = UsersRepository.getUserByName(username)?.emoji;

            if (emoji) message = t("status.emoji.isset", { emoji, username: UsersHelper.formatUsername(username, bot.mode) });
            else message = t("status.emoji.isnotset", { username: UsersHelper.formatUsername(username, bot.mode) });
        }

        bot.sendMessage(msg.chat.id, message);
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

            let insideusernames = StatusRepository.getPeopleInside()?.map(us => us.username);
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
                    });

                    logger.info(`User ${user.username} automatically ${isIn ? "got in" : "got out"}`);
                }
            }
        } catch (error) {
            this.isStatusError = true;
            logger.error(error);
        }
    }
}

function isEmoji(message) {
    return /[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]/u.test(
        message
    );
}

module.exports = StatusHandlers;
