import config from "config";
import { existsSync, mkdirSync, promises, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

import { BotConfig } from "../../config/schema";
import logger from "../../services/logger";
import { debounce } from "../../utils/common";
import HackerEmbassyBot, { BotCustomEvent, BotHandlers, LiveChatHandler } from "./HackerEmbassyBot";
import { MessageHistoryEntry } from "./MessageHistory";

const botConfig = config.get<BotConfig>("bot");

export default class BotState {
    static readonly STATE_FILE_NAME = "state.json";
    statepath: string;
    bot: HackerEmbassyBot;

    constructor(bot: HackerEmbassyBot) {
        this.statepath = join(botConfig.persistedfolderpath, BotState.STATE_FILE_NAME);
        this.bot = bot;

        if (existsSync(this.statepath)) {
            const serializedState = readFileSync(this.statepath).toString();
            logger.info("Restoring state: " + serializedState);
            const persistedState = JSON.parse(serializedState) as BotState;

            this.history = persistedState.history;
            this.liveChats = persistedState.liveChats.filter(lc => lc.expires > Date.now());
            this.initLiveChats();
        } else {
            this.history = {};
            this.liveChats = [];

            mkdirSync(dirname(this.statepath), { recursive: true });
            writeFileSync(this.statepath, JSON.stringify({ ...this, bot: undefined }));
            logger.info("Created new state");
        }
    }

    async initLiveChats() {
        for (let chatRecordIndex: number = 0; chatRecordIndex < this.liveChats.length; chatRecordIndex++) {
            const lc = this.liveChats[chatRecordIndex];
            const module = ((await import(lc.serializationData.module)) as { default: BotHandlers }).default;
            const restoredHandler = module[lc.serializationData.functionName as keyof BotHandlers] as AnyFunction;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            lc.handler = () => restoredHandler(this.bot, ...lc.serializationData.params);
            this.bot.CustomEmitter.on(lc.event, lc.handler);

            setTimeout(() => {
                this.bot.CustomEmitter.removeListener(lc.event, lc.handler);
                this.liveChats = this.liveChats.splice(chatRecordIndex, 1);
            }, lc.expires - Date.now());
        }
    }

    public liveChats: LiveChatHandler[] = [];
    public history: { [chatId: string]: Optional<MessageHistoryEntry[]> };

    clearLiveHandlers(chatId: number, event?: BotCustomEvent) {
        const toRemove = this.liveChats.filter(lc => lc.chatId === chatId).filter(lc => !event || lc.event === event);

        for (const lc of toRemove) {
            this.bot.CustomEmitter.removeListener(lc.event, lc.handler);
        }

        this.liveChats = this.liveChats.filter(lc => toRemove.indexOf(lc) === -1);

        this.persistChanges();
    }

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
