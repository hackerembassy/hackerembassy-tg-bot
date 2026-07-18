import Stream from "node:stream";

import {
    CallbackQuery,
    ChatId,
    ChatMemberUpdated,
    EditMessageMediaParams,
    EditMessageTextParams,
    Message,
    SendAnimationParams,
    SendChatActionParams,
    SendLocationParams,
    SendMediaGroupParams,
    SendMessageParams,
    SendPhotoParams,
} from "node-telegram-bot-api";

import { UserRole } from "@data/types";

import HackerEmbassyBot from "./classes/HackerEmbassyBot";
import { ButtonFlags } from "./inlineButtons";

//#region Enums
export enum BotCustomEvent {
    statusLive = "status-live",
    camLive = "cam-live",
}
//#endregion

//#region Types
export type BotAllowedReaction =
    | "👍"
    | "👎"
    | "❤"
    | "🔥"
    | "🥰"
    | "👏"
    | "😁"
    | "🤔"
    | "🤯"
    | "😱"
    | "🤬"
    | "😢"
    | "🎉"
    | "🤩"
    | "🤮"
    | "💩"
    | "🙏"
    | "👌"
    | "🕊"
    | "🤡"
    | "🥱"
    | "🥴"
    | "😍"
    | "🐳"
    | "❤‍🔥"
    | "🌚"
    | "🌭"
    | "💯"
    | "🤣"
    | "⚡"
    | "🍌"
    | "🏆"
    | "💔"
    | "🤨"
    | "😐"
    | "🍓"
    | "🍾"
    | "💋"
    | "🖕"
    | "😈"
    | "😴"
    | "😭"
    | "🤓"
    | "👻"
    | "👨‍💻"
    | "👀"
    | "🎃"
    | "🙈"
    | "😇"
    | "😨"
    | "🤝"
    | "✍"
    | "🤗"
    | "🫡"
    | "🎅"
    | "🎄"
    | "☃"
    | "💅"
    | "🤪"
    | "🗿"
    | "🆒"
    | "💘"
    | "🙉"
    | "🦄"
    | "😘"
    | "💊"
    | "🙊"
    | "😎"
    | "👾"
    | "🤷‍♂"
    | "🤷"
    | "🤷‍♀"
    | "😡";

export type MatchMapperFunction = (match: RegExpExecArray) => unknown[];

export type BotHandler = (bot: HackerEmbassyBot, msg: Message, ...rest: unknown[]) => unknown;

export type BotCallbackHandler = (bot: HackerEmbassyBot, callbackQuery: CallbackQuery) => unknown;

export type ChatMemberHandler = (bot: HackerEmbassyBot, memberUpdated: ChatMemberUpdated) => unknown;

export type EditMessageTextOptions = Omit<EditMessageTextParams, "text">;

export type SendChatActionOptions = Omit<SendChatActionParams, "chat_id" | "action">;

export type SendPhotoOptions = Omit<SendPhotoParams, "chat_id" | "photo">;

export type SendAnimationOptions = Omit<SendAnimationParams, "chat_id" | "animation">;

export type SendMessageOptions = Omit<SendMessageParams, "chat_id" | "text">;

export type SendMediaGroupOptions = Omit<SendMediaGroupParams, "chat_id" | "media">;

export type EditMessageMediaOptions = Omit<EditMessageMediaParams, "chat_id" | "media">;

export type SendLocationOptions = Omit<SendLocationParams, "chat_id" | "latitude" | "longitude">;

export type FileInput = string | Buffer | Stream.Readable | NodeJS.ReadableStream;

export type WithMessageThreadId<T> = T & { message_thread_id?: number };

export type BotController = object;
//#endregion

//#region Interfaces
export interface ITelegramUser {
    username?: Nullable<string>;
    id: number | ChatId;
    first_name?: string;
}

export interface EditMessageMediaOptionsExt extends WithMessageThreadId<EditMessageMediaOptions> {
    caption?: string;
}

export interface FileMeta {
    filename?: string;
    contentType?: string;
}

export interface BotAssets {
    images: {
        restricted: Buffer | null;
        chatnotallowed: Buffer | null;
    };
}

export interface CallbackData {
    fs?: ButtonFlags;
    vId?: number;
    cmd?: string;
    params?: unknown;
}

export interface BotRoute {
    regex: RegExp;
    handler: BotHandler;
    userRoles: UserRole[];
    allowedChats: ChatId[];
    paramMapper: Nullable<MatchMapperFunction>;
    optional: boolean;
}

export interface SerializedFunction {
    functionName: string;
    module: string;
    params: unknown[];
}

export interface MessageHistoryEntry {
    messageId: number;
    text?: string;
    from?: string;
    datetime: number;
}

export interface BotMessageContextMode {
    silent: boolean;
    mention: boolean;
    admin: boolean;
    pin: boolean;
    live: boolean;
    static: boolean;
    forward: boolean;
    secret: boolean;
}

export interface LiveChatHandler {
    chatId: ChatId;
    handler: (...args: unknown[]) => void;
    event: BotCustomEvent;
    serializationData: SerializedFunction;
}
//#endregion
