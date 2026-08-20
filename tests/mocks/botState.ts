// BotState persists chat/message history to a real file on disk (db/state.json, per
// botConfig.persistedfolderpath). Every test file constructs its own bot, and Jest runs test
// files in parallel workers, so they all read/write that one shared file concurrently - one
// worker can read it mid-write from another, getting truncated or interleaved JSON. This
// stand-in keeps BotState's public shape but never touches disk.
const DEFAULT_STATE_FLAGS = { electricityOutageMentioned: false, hideGuests: false };

export default class BotStateMock {
    liveChats: unknown[] = [];
    history: Record<string, unknown> = {};
    messages: Record<string, unknown> = {};
    flags = { ...DEFAULT_STATE_FLAGS };
    fileIdCache: Record<string, string> = {};

    async initLiveChats() {}

    clearLiveHandlers() {
        this.liveChats = [];
    }

    clearState() {
        this.liveChats = [];
        this.history = {};
        this.messages = {};
        this.flags = { ...DEFAULT_STATE_FLAGS };
        this.fileIdCache = {};
    }

    debouncedPersistChanges = () => {};

    async persistChanges() {}
}
