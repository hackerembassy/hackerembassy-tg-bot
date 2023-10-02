import { Message } from "node-telegram-bot-api";

import { BotMessageContext } from "./core/HackerEmbassyBot";

export function isPrivateMessage(msg: Message, context: BotMessageContext): boolean {
    return msg.chat.type === "private" && !context.mode.forward;
}
