/* eslint-disable @typescript-eslint/ban-types */
// Imports
import TelegramBot, {
    BotCommandScope,
    CallbackQuery,
    EditMessageTextOptions,
    Message,
    SendMessageOptions,
} from "node-telegram-bot-api";
import logger from "../services/logger";
import { sleep, chunkSubstr } from "../utils/common";
import MessageHistory from "./MessageHistory";
import { hasRole } from "../services/usersHelper";
import { t } from "i18next";
import { BotRole } from "./bot";

// Consts
const maxChunkSize = 3500;
const messagedelay = 1500;

// Helpers
function prepareMessageForMarkdown(message: string) {
    return message
        .replaceAll(/((?<![\\|#])[_*[\]()~`>+\-=|{}.!])/g, "\\$1")
        .replaceAll(/#([_*[\]()~`>+\-=|{}.!])/g, "$1")
        .replaceAll(/#/g, "");
}

function prepareOptionsForMarkdown(options: SendMessageOptions | EditMessageTextOptions) {
    options.parse_mode = "MarkdownV2";
    options.disable_web_page_preview = true;

    return options;
}

export default class HackerEmbassyBot extends TelegramBot {
    messageHistory: MessageHistory;
    Name: string;

    constructor(token: string, options: TelegramBot.ConstructorOptions) {
        super(token, options);
        this.messageHistory = new MessageHistory();
        this.Name = undefined;
    }

    accessTable = new Map();

    canUserCall(username: string, callback: (bot: HackerEmbassyBot, msg: TelegramBot.Message, ...rest: any[]) => void) {
        const savedRestrictions = this.accessTable.get(callback);

        if (savedRestrictions !== undefined && !hasRole(username, "admin", ...savedRestrictions)) {
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

    context(msg: TelegramBot.Message) {
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

    onExt(event: TelegramBot.MessageType | "callback_query", listener: Function) {
        const botthis = this;
        const newListener = async (query: CallbackQuery | Message) => {
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

    async editMessageTextExt(text: string, msg: TelegramBot.Message, options: TelegramBot.EditMessageTextOptions) {
        text = prepareMessageForMarkdown(text);
        options = prepareOptionsForMarkdown({
            ...options,
            message_thread_id: this.context(msg).messageThreadId,
        }) as EditMessageTextOptions;

        return super.editMessageText(text, options);
    }

    async sendPhotoExt(
        chatId: TelegramBot.ChatId,
        photo: string | import("stream").Stream | Buffer,
        msg: TelegramBot.Message,
        options: TelegramBot.SendPhotoOptions = {},
        fileOptions: TelegramBot.FileOptions = {}
    ) {
        this.sendChatAction(chatId, "upload_photo", msg);

        const message = await super.sendPhoto(
            chatId,
            photo,
            { ...options, message_thread_id: this.context(msg).messageThreadId },
            fileOptions
        );

        this.messageHistory.push(chatId, message.message_id);

        return Promise.resolve(message);
    }

    async sendLocationExt(
        chatId: TelegramBot.ChatId,
        latitude: number,
        longitude: number,
        msg: TelegramBot.Message,
        options: TelegramBot.SendLocationOptions = {}
    ) {
        return await super.sendLocation(chatId, latitude, longitude, {
            ...options,
            message_thread_id: this.context(msg).messageThreadId,
        });
    }

    async setMyCommands(
        commands: TelegramBot.BotCommand[],
        options: { scope: BotCommandScope; language_code?: string } = undefined
    ) {
        return super.setMyCommands(commands, {
            ...options,
            scope: JSON.stringify(options?.scope) as unknown as BotCommandScope,
        });
    }

    async sendMessageExt(
        chatId: TelegramBot.ChatId,
        text: string,
        msg: TelegramBot.Message,
        options: TelegramBot.SendMessageOptions = {}
    ) {
        const preparedText = prepareMessageForMarkdown(text);
        options = prepareOptionsForMarkdown({ ...options });

        if (!this.context(msg)?.mode?.silent) {
            const message = await super.sendMessage(chatId, preparedText, {
                ...options,
                message_thread_id: this.context(msg)?.messageThreadId,
            });

            if (!message) return;

            this.messageHistory.push(chatId, message.message_id, text);

            return Promise.resolve(message);
        }

        return Promise.resolve(null);
    }

    async sendChatAction(
        chatId: TelegramBot.ChatId,
        action: TelegramBot.ChatAction,
        msg: TelegramBot.Message,
        options: TelegramBot.SendChatActionOptions = {}
    ) {
        return super.sendChatAction(chatId, action, {
            ...options,
            message_thread_id: this.context(msg).messageThreadId,
        });
    }

    async sendLongMessage(
        chatId: TelegramBot.ChatId,
        text: string,
        msg: TelegramBot.Message,
        options: TelegramBot.SendMessageOptions = {}
    ) {
        const chunks = chunkSubstr(text, maxChunkSize);

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

    async onTextExt(
        originalRegex: RegExp,
        callback: (bot: HackerEmbassyBot, msg: TelegramBot.Message, ...any) => void,
        restrictions: BotRole[] = []
    ): Promise<void> {
        if (restrictions.length > 0) this.accessTable.set(callback, restrictions);

        const regexString = originalRegex.toString();
        const endOfBodyIndex = regexString.lastIndexOf("/");
        const regexBody = regexString.substring(1, endOfBodyIndex);
        const regexParams = regexString.substring(endOfBodyIndex + 1);
        const botthis = this;

        const newRegexp = new RegExp(regexBody.replace("$", `${botthis.addedModifiersString}$`), regexParams);

        const newCallback = async function (msg, match) {
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

    async sendOrEditMessage(chatId: number, text: string, msg: TelegramBot.Message, options: object, messageId: number) {
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

    async sendNotification(message: string, date: string, chat: TelegramBot.ChatId) {
        const currentDate = new Date().toLocaleDateString("sv").substring(8, 10);
        if (date !== currentDate) return;

        this.sendMessage(chat, message);
        logger.info(`Sent a notification to ${chat}: ${message}`);
    }
}
