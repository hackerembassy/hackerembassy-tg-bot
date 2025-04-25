import { existsSync, mkdirSync, promises, readFileSync, writeFileSync } from "fs";
import Module from "module";
import { dirname, join } from "path";

import config from "config";

import { BotConfig } from "@config";
import logger from "@services/common/logger";
import { debounce } from "@utils/common";

import HackerEmbassyBot from "./HackerEmbassyBot";
import { BotCustomEvent, BotHandlers, LiveChatHandler, MessageHistoryEntry } from "./types";

const botConfig = config.get<BotConfig>("bot");

const DEFAULT_STATE_FLAGS = {
    electricityOutageMentioned: false,
    hideGuests: false,
};

export type StateFlags = typeof DEFAULT_STATE_FLAGS;

export default class BotState {
    static readonly STATE_FILE_NAME = "state.json";
    statepath: string;
    bot: HackerEmbassyBot;

    constructor(bot: HackerEmbassyBot) {
        this.statepath = join(botConfig.persistedfolderpath, BotState.STATE_FILE_NAME);
        this.bot = bot;

        if (existsSync(this.statepath)) {
            try {
                const serializedState = readFileSync(this.statepath).toString();
                logger.info(`Restoring state: ${serializedState.substring(0, Math.min(serializedState.length, 150))}...`);
                const persistedState = JSON.parse(serializedState) as BotState;

                this.history = persistedState.history;
                this.liveChats = persistedState.liveChats;
                this.initLiveChats();
                this.flags = persistedState.flags;
                this.fileIdCache = persistedState.fileIdCache;

                return;
            } catch (error) {
                logger.error("Error while restoring state: ");
                logger.error(error);
            }
        }

        this.history = {};
        this.liveChats = [];
        this.flags = { ...DEFAULT_STATE_FLAGS };

        mkdirSync(dirname(this.statepath), { recursive: true });
        writeFileSync(this.statepath, JSON.stringify({ ...this, bot: undefined }));
        logger.info("Created new state");
    }

    async initLiveChats() {
        for (const liveChat of this.liveChats) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const importedModule = (await import(liveChat.serializationData.module)).default as
                | typeof Module
                | { default: Module };
            const module = typeof importedModule === "function" ? importedModule : importedModule.default;
            const restoredHandler = module[liveChat.serializationData.functionName as keyof BotHandlers] as
                | AnyFunction
                | undefined;

            if (!restoredHandler) {
                logger.error(`Could not restore handler for ${liveChat.event}, Live handlers are not loaded for this event.`);
                continue;
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            liveChat.handler = () => restoredHandler(this.bot, ...liveChat.serializationData.params);
            this.bot.CustomEmitter.on(liveChat.event, liveChat.handler);
        }
    }

    public liveChats: LiveChatHandler[] = [];
    public history: { [chatId: string]: Optional<MessageHistoryEntry[]> };
    public flags: StateFlags;
    public fileIdCache: { [key: string]: string } = {};

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
        this.flags = { ...DEFAULT_STATE_FLAGS };
        this.fileIdCache = {};
        this.persistChanges();
    }

    debouncedPersistChanges = debounce(async () => {
        await this.persistChanges();
    }, 1000);

    async persistChanges(): Promise<void> {
        await promises.writeFile(this.statepath, JSON.stringify({ ...this, bot: undefined }));
    }
}
