import "node-telegram-bot-api";

declare module "node-telegram-bot-api" {
    interface EditMessageReplyMarkupOptions {
        message_thread_id?: number;
    }
}
