import { AsyncLocalStorage } from "async_hooks";

import TelegramBot from "node-telegram-bot-api";

import { User } from "@data/models";

import { DEFAULT_LANGUAGE, SupportedLanguage } from "./localization";
import { BotMessageContextMode } from "./types";

export const DefaultModes: BotMessageContextMode = {
    silent: false,
    mention: false,
    admin: false,
    pin: false,
    live: false,
    static: false,
    forward: false,
    secret: false,
};

export default class BotMessageContext {
    static readonly async = new AsyncLocalStorage<BotMessageContext>();

    public mode: BotMessageContextMode = { ...DefaultModes };
    public messageThreadId?: number;
    public isEditing: boolean = false;
    public isButtonResponse: boolean = false;
    public language: SupportedLanguage = DEFAULT_LANGUAGE;

    constructor(
        public user: User,
        private msg: TelegramBot.Message,
        public command?: string
    ) {}

    public run<R>(callback: () => R) {
        return BotMessageContext.async.run(this, callback);
    }

    public isAdminMode() {
        return this.mode.admin && !this.mode.forward;
    }

    public isPrivate() {
        return this.msg.chat.type === "private" && !this.mode.forward;
    }
}
