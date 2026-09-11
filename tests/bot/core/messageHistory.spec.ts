import MessageHistory from "@hackembot/core/classes/MessageHistory";
import { ChatMessageLog, MessageLogStore } from "@hackembot/core/classes/MessageLogStore";

class InMemoryMessageLogStore implements MessageLogStore {
    loadAll(): ChatMessageLog {
        return {};
    }

    persist(): void {}

    clearAll(): void {}
}

describe("MessageHistory.getInRange", () => {
    const chatId = 1;

    afterEach(() => {
        jest.useRealTimers();
    });

    function pushAt(history: MessageHistory, datetimeMs: number, text: string) {
        jest.setSystemTime(datetimeMs);
        history.push(chatId, { messageId: datetimeMs, text, from: "someone" });
    }

    it("returns only entries within [fromMs, toMs) in chronological order", () => {
        jest.useFakeTimers();
        const history = new MessageHistory(new InMemoryMessageLogStore(), 1000);

        pushAt(history, 1000, "before");
        pushAt(history, 2000, "at-from");
        pushAt(history, 3000, "inside");
        pushAt(history, 4000, "at-to");
        pushAt(history, 5000, "after");

        const result = history.getInRange(chatId, 2000, 4000);

        expect(result.map(entry => entry.text)).toEqual(["at-from", "inside"]);
    });

    it("defaults toMs to now", () => {
        jest.useFakeTimers();
        const history = new MessageHistory(new InMemoryMessageLogStore(), 1000);

        pushAt(history, 1000, "old");
        jest.setSystemTime(5000);

        const result = history.getInRange(chatId, 500);

        expect(result.map(entry => entry.text)).toEqual(["old"]);
    });

    it("returns an empty array when nothing falls in the window", () => {
        jest.useFakeTimers();
        const history = new MessageHistory(new InMemoryMessageLogStore(), 1000);

        pushAt(history, 1000, "too-old");

        expect(history.getInRange(chatId, 5000, 6000)).toEqual([]);
    });
});
