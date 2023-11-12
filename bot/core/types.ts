import TelegramBot, { ChatId, EditMessageMediaOptions, SendMediaGroupOptions } from "node-telegram-bot-api";

import HackerEmbassyBot from "./HackerEmbassyBot";

// Enums
export enum BotCustomEvent {
    statusLive = "status-live",
    camLive = "cam-live",
}

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

export type MessageHistoryEntry = {
    messageId: number;
    text?: string;
    datetime: number;
};

export type MatchMapperFunction = (match: RegExpExecArray) => any[];

export type BotRoute = {
    regex: RegExp;
    handler: BotHandler;
    restrictions: BotRole[];
    paramMapper: Nullable<MatchMapperFunction>;
    optional: boolean;
};

export type BotHandler = (bot: HackerEmbassyBot, msg: TelegramBot.Message, ...rest: any[]) => any;

export type BotCallbackHandler = (bot: HackerEmbassyBot, callbackQuery: TelegramBot.CallbackQuery) => any;

export type ChatMemberHandler = (bot: HackerEmbassyBot, memberUpdated: TelegramBot.ChatMemberUpdated) => any;

// Intefraces
export interface BotHandlers {}

export interface ITelegramUser {
    username?: Nullable<string>;
    id: number | ChatId;
    first_name?: string;
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
