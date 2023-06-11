// Imports
const TelegramBot = require("node-telegram-bot-api");
const logger = require("../services/logger");
const { sleep, chunkSubstr } = require("../utils/common");

// Consts
const maxChunkSize = 3000;
const messagedelay = 1500;

// Helpers
function prepareMessageForMarkdown(message) {
    return message
        .replaceAll(/((?<![\\|#])[_*[\]()~`>+\-=|{}.!]{1})/g, "\\$1")
        .replaceAll(/#([_*[\]()~`>+\-=|{}.!]{1})/g, "$1")
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
    }

    mode = {
        silent: false,
        mention: false,
        admin: false,
    };

    history = [];

    onExt(event, listener) {
        let botthis = this;
        let newListener = async query => {
            listener.call(this, botthis, query);
        };

        super.on(event, newListener);
    }

    get addedModifiersString() {
        return Object.keys(this.mode)
            .reduce((acc, key) => {
                return `${acc} -${key}|`;
            }, "(")
            .replace(/\|$/, ")*");
    }

    *popLast(chatId, count) {
        for (let index = 0; index < count; index++) {
            if (!this.history[chatId] || this.history[chatId].length === 0) return [];
            yield this.history[chatId].pop();
        }
    }

    async editMessageText(text, options) {
        text = prepareMessageForMarkdown(text);
        options = prepareOptionsForMarkdown({ ...options });

        return super.editMessageText(text, options);
    }

    async sendPhoto(chatId, photo, options, fileOptions) {
        let message = await super.sendPhoto(chatId, photo, options, fileOptions);
        let messageId = message.message_id;

        if (!this.history[chatId]) this.history[chatId] = [];
        this.history[chatId].push(messageId);

        return Promise.resolve(message);
    }

    async sendMessage(chatId, text, options) {
        text = prepareMessageForMarkdown(text);
        options = prepareOptionsForMarkdown({ ...options });

        if (!this.mode.silent) {
            let message = await super.sendMessage(chatId, text, options);
            if (!message) return;
            let messageId = message.message_id;
            if (!this.history[chatId]) this.history[chatId] = [];
            this.history[chatId].push(messageId);

            return Promise.resolve(message);
        }

        return Promise.resolve(null);
    }

    async sendLongMessage(chatid, text, options) {
        let chunks = chunkSubstr(text, maxChunkSize);

        if (chunks.length === 1) {
            this.sendMessage(chatid, chunks[0], options);
            return;
        }

        for (let index = 0; index < chunks.length; index++) {
            this.sendMessage(
                chatid,
                `{${index + 1} часть}
${chunks[index]}
{Конец части ${index + 1}}`,
                options
            );
            await sleep(messagedelay);
        }
    }

    /**
     * @param {RegExp} regexp
     * @param {(bot: TelegramBot, msg: TelegramBot.Message, match: RegExpExecArray | null) => void} callback
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
            let newCommand = match[0];
            let oldmode = { ...botthis.mode };

            for (const key of Object.keys(botthis.mode)) {
                newCommand = newCommand.replace(` -${key}`, "");
                if (match[0].includes(`-${key}`)) botthis.mode[key] = true;
            }

            if (match !== undefined) match = originalRegex.exec(newCommand);

            await callback.call(this, botthis, msg, match);

            botthis.mode = oldmode;
        };

        await super.onText(regexp, newCallback);
    }

    isAdminMode() {
        return this.mode.admin;
    }

    async sendNotification(message, date, chat) {
        let currentDate = new Date().toLocaleDateString("sv").substring(8, 10);
        if (date !== currentDate) return;

        this.sendMessage(chat, message);
        logger.info(`Sent a notification to ${chat}: ${message}`);
    }

    IsMessageFromPrivateChat = msg => {
        return msg?.chat.type === "private";
    };
}

exports.HackerEmbassyBot = HackerEmbassyBot;
