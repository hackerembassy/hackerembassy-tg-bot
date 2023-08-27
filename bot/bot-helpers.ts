import { Message } from "node-telegram-bot-api";

export function isMessageFromPrivateChat(msg: Message) {
    return msg?.chat.type === "private";
}
