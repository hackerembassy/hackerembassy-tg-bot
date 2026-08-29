import { existsSync, mkdirSync } from "node:fs";
import Module from "node:module";
import path from "node:path";

import config from "config";

import { BotConfig } from "@config";
import logger from "@services/common/logger";
import { readJsonFile, writeJsonFileAtomic } from "@utils/filesystem";
import { debounce } from "@utils/common";

import HackerEmbassyBot from "./HackerEmbassyBot";
import { FileMessageLogStore, MessageLogStore } from "./MessageLogStore";
import { BotCustomEvent, BotController, LiveChatHandler } from "../types";

const botConfig = config.get<BotConfig>("bot");

const DEFAULT_STATE_FLAGS = {
    electricityOutageMentioned: false,
    hideGuests: false,
};

export type StateFlags = typeof DEFAULT_STATE_FLAGS;

export default class BotState {
    static readonly STATE_DIR_NAME = "state";
    private readonly stateDir = path.join(botConfig.persistedfolderpath, BotState.STATE_DIR_NAME);
    private readonly flagsPath = path.join(this.stateDir, "flags.json");
    private readonly fileIdCachePath = path.join(this.stateDir, "fileIdCache.json");
    private readonly liveChatsPath = path.join(this.stateDir, "liveChats.json");
    bot: HackerEmbassyBot;

    public liveChats: LiveChatHandler[] = [];
    public flags: StateFlags;
    public fileIdCache: { [key: string]: string } = {};

    constructor(bot: HackerEmbassyBot) {
        this.bot = bot;

        const legacyStatePath = path.join(botConfig.persistedfolderpath, "state.json");

        if (!existsSync(this.stateDir) && existsSync(legacyStatePath)) {
            throw new Error(
                `Found legacy ${legacyStatePath} but no ${this.stateDir} directory. ` +
                    `Run "npm run migrate-state" before starting the bot with this version.`
            );
        }

        mkdirSync(this.stateDir, { recursive: true });

        this.flags = { ...DEFAULT_STATE_FLAGS, ...readJsonFile<Partial<StateFlags>>(this.flagsPath) };
        this.fileIdCache = readJsonFile<Record<string, string>>(this.fileIdCachePath) ?? {};
        this.liveChats = readJsonFile<LiveChatHandler[]>(this.liveChatsPath) ?? [];

        this.initLiveChats().catch(error => {
            logger.error("Failed to restore live chat handlers");
            logger.error(error);
        });

        logger.info(`Restored bot state from ${this.stateDir}`);
    }

    createMessageLogStore(kind: "history" | "messages"): MessageLogStore {
        return new FileMessageLogStore(path.join(this.stateDir, kind));
    }

    async initLiveChats() {
        for (const liveChat of this.liveChats) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                const importedModule = (await import(liveChat.serializationData.module)).default as
                    typeof Module | { default: Module };
                const module = typeof importedModule === "function" ? importedModule : importedModule.default;
                const restoredHandler = module[liveChat.serializationData.functionName as keyof BotController] as
                    AnyFunction | undefined;

                if (!restoredHandler) {
                    logger.error(`Could not restore handler for ${liveChat.event}, Live handlers are not loaded for this event.`);
                    continue;
                }

                liveChat.handler = () => restoredHandler(this.bot, ...liveChat.serializationData.params);
                this.bot.customEmitter.on(liveChat.event, liveChat.handler);
            } catch (error) {
                logger.error(`Failed to restore live chat handler for ${liveChat.event} (chat ${liveChat.chatId})`);
                logger.error(error);
            }
        }
    }

    clearLiveHandlers(chatId: number, event?: BotCustomEvent) {
        const toRemove = this.liveChats.filter(lc => lc.chatId === chatId).filter(lc => !event || lc.event === event);

        for (const lc of toRemove) {
            this.bot.customEmitter.removeListener(lc.event, lc.handler);
        }

        this.liveChats = this.liveChats.filter(lc => !toRemove.includes(lc));

        this.persistLiveChats();
    }

    clearState() {
        for (const lc of this.liveChats) {
            this.bot.customEmitter.removeListener(lc.event, lc.handler);
        }
        this.liveChats = [];
        this.flags = { ...DEFAULT_STATE_FLAGS };
        this.fileIdCache = {};

        this.bot.botMessageHistory.clearAll();
        this.bot.messageHistory.clearAll();

        this.persistLiveChats();
        void this.persistFlags();
        this.writeFileIdCache();
    }

    async persistFlags(): Promise<void> {
        await writeJsonFileAtomic(this.flagsPath, this.flags);
    }

    private writeFileIdCache(): void {
        void writeJsonFileAtomic(this.fileIdCachePath, this.fileIdCache).catch(error => {
            logger.error("Failed to persist fileIdCache");
            logger.error(error);
        });
    }

    persistFileIdCache = debounce(() => this.writeFileIdCache(), 1000);

    persistLiveChats(): void {
        const serializableLiveChats = this.liveChats.map(({ chatId, event, serializationData }) => ({
            chatId,
            event,
            serializationData,
        }));

        void writeJsonFileAtomic(this.liveChatsPath, serializableLiveChats).catch(error => {
            logger.error("Failed to persist liveChats");
            logger.error(error);
        });
    }
}
