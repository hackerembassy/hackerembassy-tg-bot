import { Message } from "node-telegram-bot-api";

import { BotMessageContext } from "./core/HackerEmbassyBot";
import { Flags } from "./handlers/service";

export function isPrivateMessage(msg: Message, context: BotMessageContext): boolean {
    return msg.chat.type === "private" && !context.mode.forward;
}

export function InlineButton(text: string, command: string, flags?: Flags, options?: any) {
    return {
        text,
        callback_data: JSON.stringify({ cmd: command, fs: flags, ...options }),
    };
}
