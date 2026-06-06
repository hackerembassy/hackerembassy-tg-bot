import TelegramBot, { ChatId, EditMessageMediaOptions, SendMediaGroupOptions } from "node-telegram-bot-api";

import { UserRole } from "@data/types";

import HackerEmbassyBot from "./classes/HackerEmbassyBot";
import { ButtonFlags } from "./inlineButtons";

// Enums
export enum BotCustomEvent {
    statusLive = "status-live",
    camLive = "cam-live",
}

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

export type BotMessageContextMode = {
    silent: boolean;
    mention: boolean;
    admin: boolean;
    pin: boolean;
    live: boolean;
    static: boolean;
    forward: boolean;
    secret: boolean;
};

export type LiveChatHandler = {
    chatId: ChatId;
    handler: (...args: unknown[]) => void;
    event: BotCustomEvent;
    serializationData: SerializedFunction;
};

export type SerializedFunction = {
    functionName: string;
    module: string;
    params: unknown[];
};

export type MessageHistoryEntry = {
    messageId: number;
    text?: string;
    from?: string;
    datetime: number;
};

export type MatchMapperFunction = (match: RegExpExecArray) => unknown[];

export type BotRoute = {
    regex: RegExp;
    handler: BotHandler;
    userRoles: UserRole[];
    allowedChats: ChatId[];
    paramMapper: Nullable<MatchMapperFunction>;
    optional: boolean;
};

export type BotHandler = (bot: HackerEmbassyBot, msg: TelegramBot.Message, ...rest: unknown[]) => unknown;

export type BotCallbackHandler = (bot: HackerEmbassyBot, callbackQuery: TelegramBot.CallbackQuery) => unknown;

export type ChatMemberHandler = (bot: HackerEmbassyBot, memberUpdated: TelegramBot.ChatMemberUpdated) => unknown;

export type CallbackData = {
    fs?: ButtonFlags;
    vId?: number;
    cmd?: string;
    params?: unknown;
};

// Intefraces
export type BotController = object;

export interface ITelegramUser {
    username?: Nullable<string>;
    id: number | ChatId;
    first_name?: string;
}

export interface EditMessageMediaOptionsExt extends EditMessageMediaOptions {
    caption?: string;
    message_thread_id?: number;
}

export interface SendMediaGroupOptionsExt extends SendMediaGroupOptions {
    message_thread_id?: number;
}

export type BotAssets = {
    images: {
        restricted: Buffer | null;
        chatnotallowed: Buffer | null;
    };
};
