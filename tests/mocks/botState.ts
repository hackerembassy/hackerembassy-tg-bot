// BotState persists chat/message history and flags to real files on disk (db/state/*, per
// botConfig.persistedfolderpath). Every test file constructs its own bot, and Jest runs test
// files in parallel workers, so they all read/write those shared files concurrently - one
// worker can read one mid-write from another, getting truncated or interleaved JSON. This
// stand-in keeps BotState's public shape but never touches disk.
import { ChatMessageLog, MessageLogStore } from "@hackembot/core/classes/MessageLogStore";

const DEFAULT_STATE_FLAGS = { electricityOutageMentioned: false, hideGuests: false };

class InMemoryMessageLogStore implements MessageLogStore {
    loadAll(): ChatMessageLog {
        return {};
    }

    persist(): void {}

    clearAll(): void {}
}

export default class BotStateMock {
    liveChats: unknown[] = [];
    flags = { ...DEFAULT_STATE_FLAGS };
    fileIdCache: Record<string, string> = {};

    async initLiveChats() {}

    createMessageLogStore(): MessageLogStore {
        return new InMemoryMessageLogStore();
    }

    clearLiveHandlers() {
        this.liveChats = [];
    }

    clearState() {
        this.liveChats = [];
        this.flags = { ...DEFAULT_STATE_FLAGS };
        this.fileIdCache = {};
    }

    async persistFlags() {}

    persistFileIdCache() {}

    persistLiveChats() {}
}
