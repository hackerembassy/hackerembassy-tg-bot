import config from "config";
import { existsSync, mkdirSync, promises, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

import { BotConfig } from "../config/schema";
import { debounce } from "../utils/common";
import { LiveChatHandler } from "./HackerEmbassyBot";
import { MessageHistoryEntry } from "./MessageHistory";

const botConfig = config.get("bot") as BotConfig;

export default class BotState {
    static readonly STATE_FILE_NAME = "state.json";
    statepath: string;

    constructor() {
        this.statepath = join(botConfig.persistedfolderpath, BotState.STATE_FILE_NAME);

        if (existsSync(this.statepath)) {
            const persistedState = JSON.parse(readFileSync(this.statepath).toString());
            this.history = persistedState.history;
            // TODO add persistence logic
            // this.liveChats = (persistedState.liveChats as LiveChatHandler[]).filter(lc => lc.expires < Date.now());
        } else {
            this.history = {};
            this.liveChats = [];
            mkdirSync(dirname(this.statepath), { recursive: true });
            writeFileSync(this.statepath, JSON.stringify(this));
        }
    }

    public liveChats: LiveChatHandler[] = [];
    public history: { [chatId: string]: MessageHistoryEntry[] };

    debouncedPersistChanges = debounce(async () => {
        await this.persistChanges();
    }, 1000);

    async persistChanges(): Promise<void> {
        await promises.writeFile(this.statepath, JSON.stringify(this));
    }
}
