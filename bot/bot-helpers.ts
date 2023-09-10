import { Message } from "node-telegram-bot-api";

export function isMessageFromPrivateChat(msg: Message): boolean {
    return msg?.chat.type === "private";
}
