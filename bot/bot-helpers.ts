import TelegramBot from "node-telegram-bot-api";

export function isMessageFromPrivateChat(msg: TelegramBot.Message) {
    return msg?.chat.type === "private";
}
