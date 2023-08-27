/**
 * @typedef {import("node-telegram-bot-api").BotCommandScope} BotCommandScope
 * @typedef {import("./bot").BotRole} BotRole
 */

// Imports
const TelegramBot = require("node-telegram-bot-api");
const logger = require("../services/logger");
const { sleep, chunkSubstr } = require("../utils/common");
const MessageHistory = require("./MessageHistory");
const UsersHelper = require("../services/usersHelper");
const { t } = require("i18next");

// Consts
const maxChunkSize = 3500;
const messagedelay = 1500;

// Helpers
function prepareMessageForMarkdown(message) {
    return message
        .replaceAll(/((?<![\\|#])[_*[\]()~`>+\-=|{}.!])/g, "\\$1")
        .replaceAll(/#([_*[\]()~`>+\-=|{}.!])/g, "$1")
        .replaceAll(/#/g, "");
}

function prepareOptionsForMarkdown(options) {
    options.parse_mode = "MarkdownV2";
    options.disable_web_page_preview = true;

    return options;
}

/**
 * @class HackerEmbassyBot
 */
class HackerEmbassyBot extends TelegramBot {
    /**
     * @param {string} token
     * @param {TelegramBot.ConstructorOptions} options
     */
    constructor(token, options) {
        super(token, options);
        this.messageHistory = new MessageHistory();
        this.Name = undefined;
    }

    accessTable = new Map();

    /**
     * @param {string} username
     * @param {(bot: HackerEmbassyBot, msg: TelegramBot.Message, ...any: any[]) => void} callback
     */
    canUserCall(username, callback) {
        const savedRestrictions = this.accessTable.get(callback);

        if (savedRestrictions !== undefined && !UsersHelper.hasRole(username, "admin", ...savedRestrictions)) {
            return false;
        }

        return true;
    }

    static defaultModes = {
        silent: false,
        mention: false,
        admin: false,
    };

    #context = new Map();

    /**
     * @param {TelegramBot.Message} msg
     */
    context(msg) {
        const botthis = this;

        if (!this.#context.has(msg)) {
            const newContext = {
                mode: { ...HackerEmbassyBot.defaultModes },
                messageThreadId: undefined,
                clear() {
                    botthis.#context.delete(msg);
                },
                isAdminMode() {
                    return this.mode?.admin ?? false;
                },
                isEditing: false,
            };
            this.#context.set(msg, newContext);

            return newContext;
        }

        return this.#context.get(msg);
    }

    /**
     * @param {TelegramBot.MessageType | 'callback_query'} event
     * @param {{ (bot: any, callbackQuery: any): Promise<void>; (bot: any, msg: any): Promise<void>; call?: any; }} listener
     */
    onExt(event, listener) {
        let botthis = this;
        let newListener = async query => {
            listener.call(this, botthis, query);
        };

        // @ts-ignore
        super.on(event, newListener);
    }

    get addedModifiersString() {
        return Object.keys(HackerEmbassyBot.defaultModes)
            .reduce((acc, key) => {
                return `${acc} -${key}|`;
            }, "(")
            .replace(/\|$/, ")*");
    }

    /**
     * @param {string} text
     * @param {TelegramBot.Message} msg
     * @param {TelegramBot.EditMessageTextOptions} options
     */
    async editMessageTextExt(text, msg, options) {
        text = prepareMessageForMarkdown(text);
        options = prepareOptionsForMarkdown({ ...options, message_thread_id: this.context(msg).messageThreadId });

        return super.editMessageText(text, options);
    }

    /**
     * @param {TelegramBot.ChatId} chatId
     * @param {string | import("stream").Stream | Buffer} photo
     * @param {TelegramBot.Message} msg
     * @param {TelegramBot.SendPhotoOptions} [options]
     * @param {TelegramBot.FileOptions} [fileOptions]
     */
    async sendPhotoExt(chatId, photo, msg, options, fileOptions) {
        this.sendChatAction(chatId, "upload_photo", msg);

        let message = await super.sendPhoto(
            chatId,
            photo,
            { ...options, message_thread_id: this.context(msg).messageThreadId },
            fileOptions
        );

        this.messageHistory.push(chatId, message.message_id);

        return Promise.resolve(message);
    }

    /**
     * @param {TelegramBot.ChatId} chatId
     * @param {number} latitude
     * @param {number} longitude
     * @param {TelegramBot.Message} msg
     * @param {TelegramBot.SendLocationOptions} options
     */
    async sendLocationExt(chatId, latitude, longitude, msg, options = {}) {
        return await super.sendLocation(chatId, latitude, longitude, {
            ...options,
            message_thread_id: this.context(msg).messageThreadId,
        });
    }

    /**
     * @param {TelegramBot.BotCommand[]} commands
     * @param {{ scope: BotCommandScope; language_code?: string; }} [options]
     */
    async setMyCommands(commands, options) {
        return super.setMyCommands(commands, {
            ...options,
            scope: /**@type {BotCommandScope} */ (/**@type {unknown} */ (JSON.stringify(options?.scope))),
        });
    }

    /**
     * @param {TelegramBot.ChatId} chatId
     * @param {string} text
     * @param {TelegramBot.Message} msg
     * @param {TelegramBot.SendMessageOptions} [options]
     */
    async sendMessageExt(chatId, text, msg, options) {
        const preparedText = prepareMessageForMarkdown(text);
        options = prepareOptionsForMarkdown({ ...options });

        if (!this.context(msg)?.mode?.silent) {
            let message = await super.sendMessage(chatId, preparedText, {
                ...options,
                message_thread_id: this.context(msg)?.messageThreadId,
            });

            if (!message) return;

            this.messageHistory.push(chatId, message.message_id, text);

            return Promise.resolve(message);
        }

        return Promise.resolve(null);
    }

    /**
     * @param {TelegramBot.ChatId} chatId
     * @param {TelegramBot.ChatAction} action
     * @param {TelegramBot.Message} msg
     * @param {TelegramBot.SendChatActionOptions} options
     */
    async sendChatAction(chatId, action, msg, options = {}) {
        return super.sendChatAction(chatId, action, {
            ...options,
            message_thread_id: this.context(msg).messageThreadId,
        });
    }

    /**
     * @param {TelegramBot.ChatId} chatId
     * @param {string} text
     * @param {TelegramBot.Message} msg
     * @param {TelegramBot.SendMessageOptions} options
     */
    async sendLongMessage(chatId, text, msg, options = {}) {
        let chunks = chunkSubstr(text, maxChunkSize);

        if (chunks.length === 1) {
            this.sendMessageExt(chatId, chunks[0], msg, options);
            return;
        }

        for (let index = 0; index < chunks.length; index++) {
            this.sendMessageExt(
                chatId,
                `📧 ${index + 1} часть 📧

${chunks[index]}
📧 Конец части ${index + 1} 📧`,
                msg,
                options
            );
            await sleep(messagedelay);
        }
    }

    /**
     * @param {RegExp} originalRegex
     * @param {(bot: HackerEmbassyBot, msg: TelegramBot.Message, ...any) => void} callback
     * @param {BotRole[]} restrictions
     * @returns {Promise<void>}
     */
    async onTextExt(originalRegex, callback, restrictions = []) {
        if (restrictions.length > 0) this.accessTable.set(callback, restrictions);

        let regexString = originalRegex.toString();
        let endOfBodyIndex = regexString.lastIndexOf("/");
        let regexBody = regexString.substring(1, endOfBodyIndex);
        let regexParams = regexString.substring(endOfBodyIndex + 1);
        let botthis = this;

        let newRegexp = new RegExp(regexBody.replace("$", `${botthis.addedModifiersString}$`), regexParams);

        let newCallback = async function (msg, match) {
            try {
                if (!botthis.canUserCall(msg.from.username, callback)) {
                    await botthis.sendMessageExt(msg.chat.id, t("admin.messages.restricted"), msg);

                    return;
                }

                let newCommand = match[0];

                for (const key of Object.keys(botthis.context(msg).mode)) {
                    newCommand = newCommand.replace(` -${key}`, "");
                    if (match[0].includes(`-${key}`)) botthis.context(msg).mode[key] = true;
                }

                if (match !== undefined) match = originalRegex.exec(newCommand);

                botthis.context(msg).messageThreadId = msg?.is_topic_message ? msg.message_thread_id : undefined;

                await callback.call(this, botthis, msg, match);
            } catch (error) {
                logger.error(error);
            } finally {
                botthis.context(msg)?.clear();
            }
        };

        await super.onText(newRegexp, newCallback);
    }

    /**
     * @param {number} chatId
     * @param {string} text
     * @param {TelegramBot.Message} msg
     * @param {Object} options
     * @param {number} messageId
     */
    async sendOrEditMessage(chatId, text, msg, options, messageId) {
        if (this.context(msg).isEditing) {
            try {
                await this.editMessageTextExt(text, msg, { chat_id: chatId, message_id: messageId, ...options });
            } catch {
                // Message was not modified
            } finally {
                this.context(msg).isEditing = false;
            }
        } else {
            await this.sendMessageExt(chatId, text, msg, options);
        }
    }

    /**
     * @param {string} message
     * @param {string} date
     * @param {TelegramBot.ChatId} chat
     */
    async sendNotification(message, date, chat) {
        let currentDate = new Date().toLocaleDateString("sv").substring(8, 10);
        if (date !== currentDate) return;

        this.sendMessage(chat, message);
        logger.info(`Sent a notification to ${chat}: ${message}`);
    }
}

exports.HackerEmbassyBot = HackerEmbassyBot;
