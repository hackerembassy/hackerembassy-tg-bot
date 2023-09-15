// Imports
import { t } from "i18next";
import {
    BotCommandScope,
    CallbackQuery,
    ChatId,
    default as TelegramBot,
    EditMessageTextOptions,
    Message,
    SendMessageOptions,
} from "node-telegram-bot-api";
import { EventEmitter } from "stream";

import logger from "../services/logger";
import { hasRole } from "../services/usersHelper";
import { chunkSubstr, sleep } from "../utils/common";
import BotState from "./BotState";
import MessageHistory from "./MessageHistory";

// Consts
const maxChunkSize = 3500;
const messagedelay = 1500;
const EDIT_MESSAGE_TIME_LIMIT = 48 * 60 * 60 * 1000;

// Types
export type BotRole = "admin" | "member" | "accountant" | "default";
export type BotMessageContextMode = { silent: boolean; mention: boolean; admin: boolean; pin: boolean; live: boolean };
export type BotHandler = (bot: HackerEmbassyBot, msg: TelegramBot.Message, ...rest: any[]) => void;

export interface BotMessageContext {
    mode: BotMessageContextMode;
    messageThreadId: number | undefined;
    clear(): void;
    isAdminMode(): boolean;
    isEditing: boolean;
}

// Helpers
function prepareMessageForMarkdown(message: string): string {
    return message
        .replaceAll(/((?<![\\|#])[_*[\]()~`>+\-=|{}.!])/g, "\\$1")
        .replaceAll(/#([_*[\]()~`>+\-=|{}.!])/g, "$1")
        .replaceAll(/#/g, "")
        .replaceAll("\\u0023", "\\#");
}

function prepareOptionsForMarkdown(
    options: SendMessageOptions | EditMessageTextOptions
): TelegramBot.SendMessageOptions | TelegramBot.EditMessageTextOptions {
    options.parse_mode = "MarkdownV2";
    options.disable_web_page_preview = true;

    return options;
}

export type LiveChatHandler = {
    chatId: ChatId;
    expires: number;
    handler: (...args: any[]) => void;
};

export default class HackerEmbassyBot extends TelegramBot {
    messageHistory: MessageHistory;
    Name: string | undefined;
    CustomEmitter: EventEmitter;
    botState: BotState;

    // Seconds from bot api
    IGNORE_UPDATE_TIMEOUT = 10;

    constructor(token: string, options: TelegramBot.ConstructorOptions) {
        super(token, options);
        this.botState = new BotState();
        this.messageHistory = new MessageHistory(this.botState);
        this.Name = undefined;
        this.CustomEmitter = new EventEmitter();
    }

    accessTable = new Map();

    canUserCall(username: string | undefined, callback: BotHandler): boolean {
        if (!username) return false;

        const savedRestrictions = this.accessTable.get(callback);

        if (savedRestrictions !== undefined && !hasRole(username, "admin", ...savedRestrictions)) {
            return false;
        }

        return true;
    }

    static defaultModes: BotMessageContextMode = {
        silent: false,
        mention: false,
        admin: false,
        pin: false,
        live: false,
    };

    #context = new Map();

    context(msg: TelegramBot.Message): BotMessageContext {
        const botthis = this;

        if (!this.#context.has(msg)) {
            const newContext: BotMessageContext = {
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

        return this.#context.get(msg) as BotMessageContext;
    }

    // eslint-disable-next-line @typescript-eslint/ban-types
    onExt(event: TelegramBot.MessageType | "callback_query", listener: Function): void {
        const botthis = this;
        const newListener = async (query: CallbackQuery | Message) => {
            listener.call(this, botthis, query);
        };

        // @ts-ignore
        super.on(event, newListener);
    }

    get addedModifiersString(): string {
        return Object.keys(HackerEmbassyBot.defaultModes)
            .reduce((acc, key) => {
                return `${acc} -${key}|`;
            }, "(")
            .replace(/\|$/, ")*");
    }

    async editMessageTextExt(
        text: string,
        msg: TelegramBot.Message,
        options: TelegramBot.EditMessageTextOptions
    ): Promise<boolean | TelegramBot.Message> {
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
    ): Promise<TelegramBot.Message> {
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
    ): Promise<TelegramBot.Message> {
        return await super.sendLocation(chatId, latitude, longitude, {
            ...options,
            message_thread_id: this.context(msg).messageThreadId,
        });
    }

    async setMyCommands(
        commands: TelegramBot.BotCommand[],
        options: { scope: BotCommandScope; language_code?: string } | undefined = undefined
    ): Promise<boolean> {
        return super.setMyCommands(commands, {
            ...options,
            scope: JSON.stringify(options?.scope) as unknown as BotCommandScope,
        });
    }

    async sendMessageExt(
        chatId: TelegramBot.ChatId,
        text: string,
        msg: TelegramBot.Message | null,
        options: TelegramBot.SendMessageOptions = {}
    ): Promise<TelegramBot.Message | null> {
        const preparedText = prepareMessageForMarkdown(text);
        options = prepareOptionsForMarkdown({ ...options });

        if (!msg || !this.context(msg)?.mode?.silent) {
            const message = await this.sendMessage(chatId, preparedText, {
                ...options,
                message_thread_id: msg ? this.context(msg)?.messageThreadId : undefined,
            });

            if (!message) return null;

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
    ): Promise<boolean> {
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
    ): Promise<void> {
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

    async onTextExt(originalRegex: RegExp, callback: BotHandler, restrictions: BotRole[] = []): Promise<void> {
        if (restrictions.length > 0) this.accessTable.set(callback, restrictions);

        const regexString = originalRegex.toString();
        const endOfBodyIndex = regexString.lastIndexOf("/");
        const regexBody = regexString.substring(1, endOfBodyIndex);
        const regexParams = regexString.substring(endOfBodyIndex + 1);
        const botthis = this;

        const newRegexp = new RegExp(regexBody.replace("$", `${botthis.addedModifiersString}$`), regexParams);

        const newCallback = async function (msg: TelegramBot.Message, match: RegExpExecArray | null) {
            if (!msg) return;

            // Skip old updates
            if (Math.abs(Date.now() / 1000 - msg.date) > botthis.IGNORE_UPDATE_TIMEOUT) return;

            try {
                if (!botthis.canUserCall(msg.from?.username, callback)) {
                    await botthis.sendMessageExt(msg.chat.id, t("admin.messages.restricted"), msg);

                    return;
                }

                let executedMatch: RegExpExecArray | null = null;

                if (match !== null) {
                    let newCommand = match[0];

                    for (const key of Object.keys(botthis.context(msg).mode)) {
                        newCommand = newCommand.replace(` -${key}`, "");
                        if (match[0].includes(`-${key}`)) botthis.context(msg).mode[key as keyof BotMessageContextMode] = true;
                    }

                    executedMatch = originalRegex.exec(newCommand);
                }

                botthis.context(msg).messageThreadId = msg?.is_topic_message ? msg.message_thread_id : undefined;

                await callback.call(botthis, botthis, msg, executedMatch);
            } catch (error) {
                logger.error(error);
            } finally {
                botthis.context(msg)?.clear();
            }
        };

        super.onText(newRegexp, newCallback);
    }

    async sendOrEditMessage(
        chatId: number,
        text: string,
        msg: TelegramBot.Message,
        options: TelegramBot.EditMessageTextOptions | TelegramBot.SendMessageOptions,
        messageId: number
    ): Promise<Message | boolean | null> {
        if (this.context(msg).isEditing) {
            try {
                return await this.editMessageTextExt(text, msg, {
                    chat_id: chatId,
                    message_id: messageId,
                    ...options,
                } as TelegramBot.EditMessageTextOptions);
            } catch {
                // Message was not modified
            } finally {
                this.context(msg).isEditing = false;
            }
        } else {
            return this.sendMessageExt(chatId, text, msg, options as SendMessageOptions);
        }

        return null;
    }

    async sendNotification(message: string, date: string, chat: TelegramBot.ChatId): Promise<void> {
        const currentDate = new Date().toLocaleDateString("sv").substring(8, 10);
        if (date !== currentDate) return;

        this.sendMessage(chat, message);
        logger.info(`Sent a notification to ${chat}: ${message}`);
    }

    addLiveMessage(liveMessage: Message, event: string, handler: (...args: any[]) => void) {
        const chatRecordIndex = this.botState.liveChats.findIndex(cr => cr.chatId === liveMessage.chat.id);
        if (chatRecordIndex !== -1)
            this.CustomEmitter.removeListener("status-live", this.botState.liveChats[chatRecordIndex].handler);

        this.CustomEmitter.on(event, handler);
        const newChatRecord = { chatId: liveMessage.chat.id, expires: Date.now() + EDIT_MESSAGE_TIME_LIMIT, handler };

        if (chatRecordIndex !== -1) {
            this.botState.liveChats[chatRecordIndex] = newChatRecord;
        } else {
            this.botState.liveChats.push(newChatRecord);
        }

        this.botState.debouncedPersistChanges();

        setTimeout(() => {
            this.CustomEmitter.removeListener("status-live", handler);
        }, EDIT_MESSAGE_TIME_LIMIT);
    }
}
