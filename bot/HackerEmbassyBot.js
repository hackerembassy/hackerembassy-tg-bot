/**
 * @typedef {import("node-telegram-bot-api").BotCommandScope} BotCommandScope
 */

// Imports
const TelegramBot = require("node-telegram-bot-api");
const logger = require("../services/logger");
const { sleep, chunkSubstr } = require("../utils/common");
const MessageHistory = require("./MessageHistory");

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
    }

    context = {
        mode: {
            silent: false,
            mention: false,
            admin: false,
        },
        /**
         * @type {number | undefined}
         */
        messageThreadId: undefined,
        clear() {
            this.messageThreadId = undefined;
            this.mode.silent = false;
            this.mode.mention = false;
            this.mode.admin = false;
        },
        isAdminMode() {
            return this.context?.mode?.admin ?? false;
        },
    };

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
        return Object.keys(this.context.mode)
            .reduce((acc, key) => {
                return `${acc} -${key}|`;
            }, "(")
            .replace(/\|$/, ")*");
    }

    /**
     * @param {string} text
     * @param {TelegramBot.EditMessageTextOptions} options
     */
    async editMessageText(text, options) {
        text = prepareMessageForMarkdown(text);
        options = prepareOptionsForMarkdown({ ...options, message_thread_id: this.context.messageThreadId });

        return super.editMessageText(text, options);
    }

    /**
     * @param {TelegramBot.ChatId} chatId
     * @param {string | import("stream").Stream | Buffer} photo
     * @param {TelegramBot.SendPhotoOptions} [options]
     * @param {TelegramBot.FileOptions} [fileOptions]
     */
    async sendPhoto(chatId, photo, options, fileOptions) {
        let message = await super.sendPhoto(
            chatId,
            photo,
            { ...options, message_thread_id: this.context.messageThreadId },
            fileOptions
        );

        this.messageHistory.push(chatId, message.message_id);

        return Promise.resolve(message);
    }

    /**
     * @param {TelegramBot.ChatId} chatId
     * @param {number} latitude
     * @param {number} longitude
     * @param {TelegramBot.SendLocationOptions} options
     */
    async sendLocation(chatId, latitude, longitude, options = {}) {
        return await super.sendLocation(chatId, latitude, longitude, {
            ...options,
            message_thread_id: this.context.messageThreadId,
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
     * @param {TelegramBot.SendMessageOptions} [options]
     */
    async sendMessage(chatId, text, options) {
        const preparedText = prepareMessageForMarkdown(text);
        options = prepareOptionsForMarkdown({ ...options });

        if (!this.context.mode.silent) {
            let message = await super.sendMessage(chatId, preparedText, {
                ...options,
                message_thread_id: this.context.messageThreadId,
            });

            if (!message) return;

            this.messageHistory.push(chatId, message.message_id, text);

            return Promise.resolve(message);
        }

        return Promise.resolve(null);
    }

    /**
     * @param {TelegramBot.ChatId} chatId
     * @param {string} text
     * @param {TelegramBot.SendMessageOptions} options
     */
    async sendLongMessage(chatId, text, options) {
        let chunks = chunkSubstr(text, maxChunkSize);

        if (chunks.length === 1) {
            this.sendMessage(chatId, chunks[0], options);
            return;
        }

        for (let index = 0; index < chunks.length; index++) {
            this.sendMessage(
                chatId,
                `📧 ${index + 1} часть 📧

${chunks[index]}
📧 Конец части ${index + 1} 📧`,
                options
            );
            await sleep(messagedelay);
        }
    }

    /**
     * @param {RegExp} regexp
     * @param {(bot: HackerEmbassyBot, msg: TelegramBot.Message, match: RegExpExecArray | null) => void} callback
     * @returns {Promise<void>}
     */
    async onTextExt(regexp, callback) {
        let originalRegex = regexp;
        let regexString = originalRegex.toString();
        let endOfBodyIndex = regexString.lastIndexOf("/");
        let regexBody = regexString.substring(1, endOfBodyIndex);
        let regexParams = regexString.substring(endOfBodyIndex + 1);
        let botthis = this;

        regexp = new RegExp(regexBody.replace("$", `${this.addedModifiersString}$`), regexParams);

        let newCallback = async function (msg, match) {
            try {
                let newCommand = match[0];

                for (const key of Object.keys(botthis.context.mode)) {
                    newCommand = newCommand.replace(` -${key}`, "");
                    if (match[0].includes(`-${key}`)) botthis.context.mode[key] = true;
                }

                if (match !== undefined) match = originalRegex.exec(newCommand);

                botthis.context.messageThreadId = msg?.is_topic_message ? msg.message_thread_id : undefined;

                await callback.call(this, botthis, msg, match);
            } catch (error) {
                logger.error(error);
            } finally {
                botthis.context.clear();
            }
        };

        await super.onText(regexp, newCallback);
    }

    /**
     * @param {number} chatId
     * @param {string} text
     * @param {Object} options
     * @param {boolean} edit
     * @param {number} messageId
     */
    async sendOrEditMessage(chatId, text, options, edit, messageId) {
        if (edit) {
            try {
                await this.editMessageText(text, { chat_id: chatId, message_id: messageId, ...options });
            } catch {
                // Message was not modified
            }
        } else {
            await this.sendMessage(chatId, text, options);
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
