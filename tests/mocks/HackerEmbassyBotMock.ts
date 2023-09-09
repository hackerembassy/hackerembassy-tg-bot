import { ChatId, Message, SendMessageOptions } from "node-telegram-bot-api";

import HackerEmbassyBot from "../../bot/HackerEmbassyBot";

export class HackerEmbassyBotMock extends HackerEmbassyBot {
    constructor(token: string, options: any) {
        super(token, options);
    }

    private results: string[] = [];

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override sendMessage(chatId: ChatId, text: string, options: SendMessageOptions): Promise<Message> {
        // console.log(`Sending message to chat ${chatId}: ${text} with ${options}`);
        this.results.push(text);
        // @ts-ignore
        return Promise.resolve(null);
    }

    public getResults(): string[] {
        return this.results;
    }
}
