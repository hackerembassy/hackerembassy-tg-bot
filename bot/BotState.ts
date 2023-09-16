import config from "config";
import { existsSync, mkdirSync, promises, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

import { BotConfig } from "../config/schema";
import { debounce } from "../utils/common";
import HackerEmbassyBot, { LiveChatHandler } from "./HackerEmbassyBot";
import { MessageHistoryEntry } from "./MessageHistory";

const botConfig = config.get("bot") as BotConfig;

export default class BotState {
    static readonly STATE_FILE_NAME = "state.json";
    statepath: string;
    bot: HackerEmbassyBot;

    constructor(bot: HackerEmbassyBot) {
        this.statepath = join(botConfig.persistedfolderpath, BotState.STATE_FILE_NAME);
        this.bot = bot;

        if (existsSync(this.statepath)) {
            const persistedState = JSON.parse(readFileSync(this.statepath).toString());
            this.history = persistedState.history;
            this.liveChats = (persistedState.liveChats as LiveChatHandler[]).filter(lc => lc.expires > Date.now());
            this.initLiveChats();
        } else {
            this.history = {};
            this.liveChats = [];
            mkdirSync(dirname(this.statepath), { recursive: true });
            writeFileSync(this.statepath, JSON.stringify({ ...this, bot: undefined }));
        }
    }

    async initLiveChats() {
        for (let chatRecordIndex: number = 0; chatRecordIndex < this.liveChats.length; chatRecordIndex++) {
            const lc = this.liveChats[chatRecordIndex];
            const module = (await import(lc.serializationData.module)).default;
            const restoredHandler = module[lc.serializationData.functionName];
            lc.handler = () => restoredHandler(this.bot, ...lc.serializationData.params);
            this.bot.CustomEmitter.on(lc.event, lc.handler);

            setTimeout(() => {
                this.bot.CustomEmitter.removeListener(lc.event, lc.handler);
                this.liveChats = this.liveChats.splice(chatRecordIndex, 1);
            }, lc.expires - Date.now());
        }
    }

    public liveChats: LiveChatHandler[] = [];
    public history: { [chatId: string]: MessageHistoryEntry[] };

    clearState() {
        for (const lc of this.liveChats) {
            this.bot.CustomEmitter.removeListener(lc.event, lc.handler);
        }
        this.liveChats = [];
        this.history = {};
        this.persistChanges();
    }

    debouncedPersistChanges = debounce(async () => {
        await this.persistChanges();
    }, 1000);

    async persistChanges(): Promise<void> {
        await promises.writeFile(this.statepath, JSON.stringify({ ...this, bot: undefined }));
    }
}
