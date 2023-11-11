// Imports
import config from "config";
import { promises as fs } from "fs";
import { t } from "i18next";
import {
    BotCommandScope,
    CallbackQuery,
    ChatId,
    ChatMemberUpdated,
    default as TelegramBot,
    EditMessageMediaOptions,
    EditMessageTextOptions,
    InlineKeyboardMarkup,
    InputMedia,
    InputMediaPhoto,
    Message,
    SendMediaGroupOptions,
    SendMessageOptions,
} from "node-telegram-bot-api";
import { EventEmitter, Stream } from "stream";
import { file } from "tmp-promise";

import { BotConfig } from "../../config/schema";
import logger from "../../services/logger";
import { hasRole } from "../../services/usersHelper";
import { chunkSubstr, sleep } from "../../utils/common";
import { OptionalRegExp } from "../../utils/regexp";
import BotState from "./BotState";
import MessageHistory from "./MessageHistory";

const botConfig = config.get<BotConfig>("bot");

// Consts
const maxChunkSize = 3500;
const messagedelay = 1500;
const EDIT_MESSAGE_TIME_LIMIT = 48 * 60 * 60 * 1000;
export const IGNORE_UPDATE_TIMEOUT = 8; // Seconds from bot api
const defaultForwardTarget = botConfig.chats.main;

// Types
export type BotRole = "admin" | "member" | "accountant" | "trusted" | "default" | "restricted";
export type BotMessageContextMode = {
    silent: boolean;
    mention: boolean;
    admin: boolean;
    pin: boolean;
    live: boolean;
    static: boolean;
    forward: boolean;
};

export interface BotHandlers {}

export type BotHandler = (bot: HackerEmbassyBot, msg: TelegramBot.Message, ...rest: any[]) => any;
export type BotCallbackHandler = (bot: HackerEmbassyBot, callbackQuery: TelegramBot.CallbackQuery) => any;
export type ChatMemberHandler = (bot: HackerEmbassyBot, memberUpdated: TelegramBot.ChatMemberUpdated) => any;

export interface ITelegramUser {
    username?: Nullable<string>;
    id: number | ChatId;
    first_name?: string;
}

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
    isButtonResponse: boolean;
}

export interface EditMessageMediaOptionsExt extends EditMessageMediaOptions {
    caption?: string;
    message_thread_id?: number;
}

export interface SendMediaGroupOptionsExt extends SendMediaGroupOptions {
    message_thread_id?: number;
}

export const RESTRICTED_PERMISSIONS = {
    can_send_messages: false,
    can_send_audios: false,
    can_send_documents: false,
    can_send_photos: false,
    can_send_videos: false,
    can_send_video_notes: false,
    can_send_voice_notes: false,
    can_send_polls: false,
    can_send_other_messages: false,
    can_add_web_page_previews: false,
    can_change_info: false,
    can_invite_users: false,
    can_pin_messages: false,
    can_manage_topics: false,
};

export const FULL_PERMISSIONS = {
    can_send_messages: true,
    can_send_audios: true,
    can_send_documents: true,
    can_send_photos: true,
    can_send_videos: true,
    can_send_video_notes: true,
    can_send_voice_notes: true,
    can_send_polls: true,
    can_send_other_messages: true,
    can_add_web_page_previews: true,
    can_change_info: true,
    can_invite_users: true,
    can_pin_messages: true,
    can_manage_topics: true,
};

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
    serializationData: SerializedFunction;
};

export type SerializedFunction = {
    functionName: string;
    module: string;
    params: any[];
};

export type MatchMapperFunction = (match: RegExpExecArray) => any[];

export type BotRoute = {
    regex: RegExp;
    handler: BotHandler;
    restrictions: BotRole[];
    paramMapper: Nullable<MatchMapperFunction>;
    optional: boolean;
};

export default class HackerEmbassyBot extends TelegramBot {
    static defaultModes: BotMessageContextMode = {
        silent: false,
        mention: false,
        admin: false,
        pin: false,
        live: false,
        static: false,
        forward: false,
    };

    public messageHistory: MessageHistory;
    public Name: Optional<string>;
    public CustomEmitter: EventEmitter;
    public botState: BotState;
    public routeMap = new Map<string, BotRoute>();

    private contextMap = new Map();

    constructor(token: string, options: TelegramBot.ConstructorOptions) {
        super(token, options);
        this.botState = new BotState(this);
        this.messageHistory = new MessageHistory(this.botState);
        this.Name = undefined;
        this.CustomEmitter = new EventEmitter();
    }

    canUserCall(username: string | undefined, command: string): boolean {
        const savedRestrictions = this.routeMap.get(command)?.restrictions;

        if (!savedRestrictions) return true;

        if (username) return hasRole(username, "admin", ...savedRestrictions);

        return savedRestrictions.includes("default");
    }

    context(msg: TelegramBot.Message): BotMessageContext {
        const botthis = this;

        if (!this.contextMap.has(msg)) {
            const newContext: BotMessageContext = {
                mode: { ...HackerEmbassyBot.defaultModes },
                messageThreadId: undefined,
                clear() {
                    botthis.contextMap.delete(msg);
                },
                isAdminMode() {
                    return this.mode.admin && !this.mode.forward;
                },
                isEditing: false,
                isButtonResponse: false,
            };
            this.contextMap.set(msg, newContext);

            return newContext;
        }

        return this.contextMap.get(msg) as BotMessageContext;
    }

    onExt(
        event: TelegramBot.MessageType | "callback_query" | "chat_member",
        listener: BotHandler | BotCallbackHandler | ChatMemberHandler
    ): void {
        const newListener = (query: CallbackQuery | Message) => {
            listener.bind(this)(this, query as CallbackQuery & Message & ChatMemberUpdated);
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

    editMessageTextExt(
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
        const mode = this.context(msg).mode;
        const chatIdToUse = mode.forward ? defaultForwardTarget : chatId;
        const inline_keyboard =
            mode.static || !options.reply_markup ? [] : (options.reply_markup as InlineKeyboardMarkup).inline_keyboard;

        this.sendChatAction(chatId, "upload_photo", msg);

        const message = await super.sendPhoto(
            chatIdToUse,
            photo,
            {
                ...options,
                reply_markup: {
                    inline_keyboard,
                },
                message_thread_id: this.context(msg).messageThreadId,
            },
            fileOptions
        );

        if (mode.pin) {
            this.tryPinChatMessage(message, msg.from?.username);
        }

        this.messageHistory.push(chatId, message.message_id);

        return Promise.resolve(message);
    }

    async sendPhotos(
        chatId: TelegramBot.ChatId,
        photos: Buffer[] | ArrayBuffer[],
        msg: TelegramBot.Message,
        options: SendMediaGroupOptionsExt = {}
    ): Promise<TelegramBot.Message> {
        const mode = this.context(msg).mode;
        const chatIdToUse = mode.forward ? defaultForwardTarget : chatId;

        this.sendChatAction(chatId, "upload_photo", msg);

        const buffers = photos.map(photo => (photo instanceof Buffer ? photo : Buffer.from(photo)));
        const imageOpts = buffers.map(buf => ({ type: "photo", media: buf as unknown as string }));

        const message = await super.sendMediaGroup(chatIdToUse, imageOpts as InputMedia[], {
            ...options,
            // @ts-ignore
            message_thread_id: this.context(msg).messageThreadId,
        });

        this.messageHistory.push(chatId, message.message_id);

        return Promise.resolve(message);
    }

    async editPhoto(
        photo: Buffer | ArrayBuffer,
        msg: TelegramBot.Message,
        options: EditMessageMediaOptionsExt = {}
    ): Promise<TelegramBot.Message | boolean> {
        const buffer = photo instanceof Buffer ? photo : Buffer.from(photo);

        // TMP file because the lib doesn't support using buffers for editMessageMedia yet
        const { path, cleanup } = await file();

        await fs.writeFile(path, buffer);

        const imageOption = { type: "photo", media: `attach://${path}` } as InputMediaPhoto;

        const inline_keyboard =
            this.context(msg).mode.static || !options.reply_markup ? [] : options.reply_markup.inline_keyboard;

        let message: Message | boolean = false;

        message = await super.editMessageMedia(imageOption, {
            ...options,
            reply_markup: {
                inline_keyboard,
            },
            chat_id: msg.chat.id,
            message_id: msg.message_id,
            //@ts-ignore
            message_thread_id: this.context(msg).messageThreadId,
        });

        if (options.caption) {
            super.editMessageCaption(options.caption, {
                chat_id: msg.chat.id,
                message_id: msg.message_id,
                reply_markup: { inline_keyboard },
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

    setMyCommands(
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
        const inline_keyboard =
            mode?.static || !options.reply_markup ? [] : (options.reply_markup as InlineKeyboardMarkup).inline_keyboard;
        const message_thread_id = msg ? this.context(msg).messageThreadId : undefined;

        if (!msg || !mode?.silent) {
            const message = await this.sendMessage(chatIdToUse, preparedText, {
                ...options,
                reply_markup: {
                    inline_keyboard,
                },
                message_thread_id,
            });

            if (mode?.pin) {
                this.tryPinChatMessage(message, msg?.from?.username);
            }

            this.messageHistory.push(chatId, message.message_id, text);

            return Promise.resolve(message);
        }

        return Promise.resolve(null);
    }

    tryPinChatMessage(message: TelegramBot.Message, username?: string) {
        try {
            if (username && hasRole(username, "admin", "member")) {
                this.pinChatMessage(message.chat.id, message.message_id, { disable_notification: true });
            }
        } catch (e) {
            logger.error(e);
        }
    }

    sendChatAction(
        chatId: TelegramBot.ChatId,
        action: TelegramBot.ChatAction,
        msg: TelegramBot.Message,
        options: TelegramBot.SendChatActionOptions = {}
    ): Promise<boolean> {
        const mode = this.context(msg).mode;
        const chatIdToUse = mode.forward ? defaultForwardTarget : chatId;

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

    async routeMessage(message: TelegramBot.Message) {
        try {
            // Skip old updates
            if (Math.abs(Date.now() / 1000 - message.date) > IGNORE_UPDATE_TIMEOUT) return;

            const text = message.text;
            if (!text) return;

            const fullCommand = text.split(" ")[0];
            const command = fullCommand.split("@")[0].slice(1);

            const route = this.routeMap.get(command);
            if (!route) return;

            // check restritions
            if (route.restrictions.length > 0 && !this.canUserCall(message.from?.username, command)) {
                this.sendMessageExt(message.chat.id, t("admin.messages.restricted"), message);
                return;
            }

            // parse global modifiers
            let textToMatch = text;

            for (const key of Object.keys(this.context(message).mode)) {
                if (textToMatch.includes(`-${key}`)) this.context(message).mode[key as keyof BotMessageContextMode] = true;
                textToMatch = textToMatch.replace(` -${key}`, "");
            }

            this.context(message).messageThreadId = message.is_topic_message ? message.message_thread_id : undefined;

            // call with or without params
            if (route.paramMapper) {
                const match = route.regex.exec(textToMatch);
                const matchedParams = match ? route.paramMapper(match) : null;

                if (matchedParams) {
                    await route.handler(this, message, ...matchedParams);
                    return;
                } else if (!route.optional) {
                    return;
                }
            }

            await route.handler(this, message);
        } catch (error) {
            logger.error(error);
        } finally {
            this.context(message).clear();
        }
    }

    addRoute(
        aliases: string[],
        handler: BotHandler,
        paramRegex: Nullable<RegExp> = null,
        paramMapper: Nullable<MatchMapperFunction> = null,
        restrictions: BotRole[] = []
    ): void {
        const optional = paramRegex instanceof OptionalRegExp;

        const botRoute = {
            regex: this.createRegex(aliases, paramRegex, optional),
            handler,
            restrictions,
            paramMapper,
            optional,
        };

        for (const alias of aliases) {
            this.routeMap.set(alias, botRoute);
        }
    }

    private createRegex(aliases: string[], paramRegex: Nullable<RegExp>, optional: boolean = false) {
        const commandPart = `/(?:${aliases.join("|")})`;
        const botnamePart = this.Name ? `(?:@${this.Name})?` : "";

        let paramsPart = "";
        if (paramRegex) paramsPart = optional ? paramRegex.source : ` ${paramRegex.source}`;

        return new RegExp(`^${commandPart}${botnamePart}${paramsPart}$`, paramRegex?.flags);
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
            return this.sendPhotoExt(chatId, photo as Buffer, msg, options);
        }

        return null;
    }

    // TODO add READ state
    async sendNotification(message: string, monthDay: number, chat: TelegramBot.ChatId): Promise<void> {
        const currentDate = new Date().getDate();
        if (monthDay !== currentDate) return;

        await this.sendMessage(chat, message);
        logger.info(`Sent a notification to ${chat}: ${message}`);
    }

    addLiveMessage(
        liveMessage: Message,
        event: BotCustomEvent,
        handler: (...args: any[]) => Promise<void>,
        serializationData: SerializedFunction
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

    //@ts-ignore
    restrictChatMember(
        chatId: ChatId,
        userId: number,
        options: TelegramBot.ChatPermissions & {
            until_date?: number;
            use_independent_chat_permissions?: boolean;
        }
    ) {
        //@ts-ignore
        return super.restrictChatMember(chatId, userId, options);
    }

    /*
     * Deprecated base TelegramBot methods.
     * They don't know how to properly handle message context, message modes,
     * message threads, custom events etc, so use their extended versions outside of this class.
     */

    /**
     * @deprecated Do not use directly
     * @see editMessageTextExt
     */
    editMessageText(
        text: string,
        options?: TelegramBot.EditMessageTextOptions | undefined
    ): Promise<boolean | TelegramBot.Message> {
        return super.editMessageText(text, options);
    }

    /**
     * @deprecated Do not use directly
     * @see sendPhotoExt
     */
    sendPhoto(
        chatId: ChatId,
        photo: string | Stream | Buffer,
        options?: TelegramBot.SendPhotoOptions | undefined,
        fileOptions?: TelegramBot.FileOptions | undefined
    ): Promise<TelegramBot.Message> {
        return super.sendPhoto(chatId, photo, options, fileOptions);
    }

    /**
     * @deprecated Do not use directly
     * @see sendMessageExt
     */
    sendMessage(
        chatId: ChatId,
        text: string,
        options?: TelegramBot.SendMessageOptions | undefined
    ): Promise<TelegramBot.Message> {
        return super.sendMessage(chatId, text, options);
    }

    /**
     * @deprecated Do not use directly
     * @see sendLocationExt
     */
    sendLocation(
        chatId: ChatId,
        latitude: number,
        longitude: number,
        options?: TelegramBot.SendLocationOptions | undefined
    ): Promise<TelegramBot.Message> {
        return super.sendLocation(chatId, latitude, longitude, options);
    }

    /**
     * @deprecated Do not use directly
     * @see addRoute
     */
    onText(regexp: RegExp, callback: (msg: TelegramBot.Message, match: RegExpExecArray | null) => void): void {
        return super.onText(regexp, callback);
    }
}
