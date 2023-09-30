// Imports
import config from "config";
import { promises as fs } from "fs";
import { t } from "i18next";
import {
    BotCommandScope,
    CallbackQuery,
    ChatId,
    default as TelegramBot,
    EditMessageTextOptions,
    InlineKeyboardMarkup,
    InputMedia,
    InputMediaPhoto,
    Message,
    SendMessageOptions,
    SendPhotoOptions,
} from "node-telegram-bot-api";
import { EventEmitter } from "stream";
import { file } from "tmp-promise";

import { BotConfig } from "../config/schema";
import logger from "../services/logger";
import { hasRole } from "../services/usersHelper";
import { chunkSubstr, sleep } from "../utils/common";
import BotState from "./BotState";
import MessageHistory from "./MessageHistory";

const botConfig = config.get("bot") as BotConfig;

// Consts
const maxChunkSize = 3500;
const messagedelay = 1500;
const EDIT_MESSAGE_TIME_LIMIT = 48 * 60 * 60 * 1000;
const defaultForwardTarget = botConfig.chats.main;

// Types
export type BotRole = "admin" | "member" | "accountant" | "default";
export type BotMessageContextMode = {
    silent: boolean;
    mention: boolean;
    admin: boolean;
    pin: boolean;
    live: boolean;
    static: boolean;
    forward: boolean;
};
export type BotHandler = (bot: HackerEmbassyBot, msg: TelegramBot.Message, ...rest: any[]) => Promise<any>;
export enum BotCustomEvent {
    statusLive = "status-live",
    camLive = "cam-live",
}

export interface BotMessageContext {
    mode: BotMessageContextMode;
    messageThreadId: number | undefined;
    clear(): void;
    isAdminMode(): boolean;
    isEditing: boolean;
}

// Helpers

/**
 * Bot uses MarkdownV2 by default, because it's needed for almost every command.
 * But we still want to be able to use markdown special symbols as regular symbols in some cases.
 * To allow this we prefix these symbols with # when we need them to be used as markup.
 * @param message where functional markup symbols are escaped with #
 * @returns string where these are converted to a usual Markdownv2 format
 */
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
    event: BotCustomEvent;
    serializationData: serializedFunction;
};

export type serializedFunction = {
    functionName: string;
    module: string;
    params: any[];
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
        this.botState = new BotState(this);
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
        static: false,
        forward: false,
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
                    return (this.mode?.admin && !this.mode?.forward) ?? false;
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
        const mode = msg && this.context(msg).mode;
        const chatIdToUse = mode?.forward ? defaultForwardTarget : chatId;

        this.sendChatAction(chatId, "upload_photo", msg);

        const message = await super.sendPhoto(
            chatIdToUse,
            photo,
            {
                ...options,
                reply_markup: {
                    inline_keyboard: this.context(msg).mode?.static
                        ? []
                        : (options?.reply_markup as InlineKeyboardMarkup)?.inline_keyboard,
                },
                message_thread_id: this.context(msg).messageThreadId,
            },
            fileOptions
        );

        this.messageHistory.push(chatId, message.message_id);

        return Promise.resolve(message);
    }

    async sendPhotos(
        chatId: TelegramBot.ChatId,
        photos: Buffer[] | ArrayBuffer[],
        msg: TelegramBot.Message,
        options: any = {}
    ): Promise<TelegramBot.Message> {
        const mode = msg && this.context(msg).mode;
        const chatIdToUse = mode?.forward ? defaultForwardTarget : chatId;

        this.sendChatAction(chatId, "upload_photo", msg);

        const buffers = photos.map(photo => (photo instanceof Buffer ? photo : Buffer.from(photo)));
        const imageOpts = buffers.map(buf => ({ type: "photo", media: buf as unknown as string }));

        const message = await super.sendMediaGroup(
            chatIdToUse,
            imageOpts as InputMedia[],
            {
                ...options,
                message_thread_id: this.context(msg).messageThreadId,
            } as any
        );

        if (message) {
            this.messageHistory.push(chatId, message.message_id);
        }

        return Promise.resolve(message);
    }

    async editPhoto(
        photo: Buffer | ArrayBuffer,
        msg: TelegramBot.Message,
        options: any = {}
    ): Promise<TelegramBot.Message | boolean> {
        const buffer = photo instanceof Buffer ? photo : Buffer.from(photo);

        // TMP file because the lib doesn't support using buffers for editMessageMedia yet
        const { path, cleanup } = await file();

        await fs.writeFile(path, buffer);

        const imageOption = { type: "photo", media: `attach://${path}` } as InputMediaPhoto;

        const inlineKeyboard = this.context(msg).mode?.static ? [] : options.reply_markup.inline_keyboard;

        let message: Message | boolean = false;

        message = await super.editMessageMedia(imageOption, {
            ...options,
            reply_markup: {
                inline_keyboard: inlineKeyboard,
            },
            chat_id: msg.chat.id,
            message_id: msg.message_id,
            message_thread_id: this.context(msg).messageThreadId,
        } as any);

        if (options.caption) {
            await super.editMessageCaption(options.caption, {
                chat_id: msg.chat.id,
                message_id: msg.message_id,
                reply_markup: { inline_keyboard: inlineKeyboard },
            });
        }

        cleanup();

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
        msg: Nullable<TelegramBot.Message>,
        options: TelegramBot.SendMessageOptions = {}
    ): Promise<Nullable<TelegramBot.Message>> {
        const preparedText = prepareMessageForMarkdown(text);
        options = prepareOptionsForMarkdown({ ...options });

        const mode = msg && this.context(msg).mode;
        const chatIdToUse = mode?.forward ? defaultForwardTarget : chatId;
        const inline_keyboard = mode?.static ? [] : (options?.reply_markup as InlineKeyboardMarkup)?.inline_keyboard;
        const message_thread_id = msg ? this.context(msg)?.messageThreadId : undefined;

        if (!msg || !mode?.silent) {
            const message = await this.sendMessage(chatIdToUse, preparedText, {
                ...options,
                reply_markup: {
                    inline_keyboard,
                },
                message_thread_id,
            });

            if (message) {
                this.messageHistory.push(chatId, message.message_id, text);

                return Promise.resolve(message);
            }
        }

        return Promise.resolve(null);
    }

    async sendChatAction(
        chatId: TelegramBot.ChatId,
        action: TelegramBot.ChatAction,
        msg: TelegramBot.Message,
        options: TelegramBot.SendChatActionOptions = {}
    ): Promise<boolean> {
        const mode = msg && this.context(msg).mode;
        const chatIdToUse = mode?.forward ? defaultForwardTarget : chatId;

        return super.sendChatAction(chatIdToUse, action, {
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

        const newCallback = async function (msg: TelegramBot.Message, match: Nullable<RegExpExecArray>) {
            if (!msg) return;

            // Skip old updates
            if (Math.abs(Date.now() / 1000 - msg.date) > botthis.IGNORE_UPDATE_TIMEOUT) return;

            try {
                if (!botthis.canUserCall(msg.from?.username, callback)) {
                    await botthis.sendMessageExt(msg.chat.id, t("admin.messages.restricted"), msg);

                    return;
                }

                let executedMatch: Nullable<RegExpExecArray> = null;

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

    async sendOrEditPhoto(
        chatId: number,
        photo: Buffer | ArrayBuffer,
        msg: TelegramBot.Message,
        options: TelegramBot.SendPhotoOptions
    ): Promise<Message | boolean | null> {
        if (this.context(msg).isEditing) {
            try {
                return await this.editPhoto(photo, msg, {
                    chat_id: chatId,
                    message_id: msg.message_id,
                    ...options,
                } as TelegramBot.EditMessageTextOptions);
            } catch {
                // Message was not modified
            } finally {
                this.context(msg).isEditing = false;
            }
        } else {
            return this.sendPhotoExt(chatId, photo as Buffer, msg, options as SendPhotoOptions);
        }

        return null;
    }

    async sendNotification(message: string, date: string, chat: TelegramBot.ChatId): Promise<void> {
        const currentDate = new Date().toLocaleDateString("sv").substring(8, 10);
        if (date !== currentDate) return;

        this.sendMessage(chat, message);
        logger.info(`Sent a notification to ${chat}: ${message}`);
    }

    addLiveMessage(
        liveMessage: Message,
        event: BotCustomEvent,
        handler: (...args: any[]) => Promise<void>,
        serializationData: serializedFunction
    ) {
        const chatRecordIndex = this.botState.liveChats.findIndex(cr => cr.chatId === liveMessage.chat.id && cr.event === event);
        if (chatRecordIndex !== -1) this.CustomEmitter.removeListener(event, this.botState.liveChats[chatRecordIndex].handler);

        this.CustomEmitter.on(event, handler);
        const newChatRecord = {
            chatId: liveMessage.chat.id,
            expires: Date.now() + EDIT_MESSAGE_TIME_LIMIT,
            handler,
            event,
            serializationData,
        };

        if (chatRecordIndex !== -1) {
            this.botState.liveChats[chatRecordIndex] = newChatRecord;
        } else {
            this.botState.liveChats.push(newChatRecord);
        }

        this.botState.debouncedPersistChanges();

        // TODO Remove duplication
        setTimeout(() => {
            this.CustomEmitter.removeListener(event, handler);
            this.botState.liveChats = this.botState.liveChats.splice(chatRecordIndex, 1);
        }, EDIT_MESSAGE_TIME_LIMIT);
    }
}
