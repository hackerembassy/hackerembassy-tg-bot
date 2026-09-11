import config from "config";

import { BotConfig } from "@config";
import { TEST_USERS } from "@data/seed";
import ServiceController from "@hackembot/controllers/service";

import { createMockBot, createMockMessage } from "../../mocks/bot";

const botConfig = config.get<BotConfig>("bot");
const TLDR_CHAT_ID = botConfig.chats.test; // in both PublicChats and NonTopicChats

describe("Bot Service commands:", () => {
    const mockBot = createMockBot();

    test("/setlanguage rejects unsupported input and offers a selector otherwise", async () => {
        await mockBot.processUpdate(createMockMessage("/setlanguage xx", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/setlanguage", TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual(["service\\.setlanguage\\.notsupported", "service\\.setlanguage\\.select"]);
    });

    test("/token can be set, viewed, and removed by a trusted member", async () => {
        await mockBot.processUpdate(createMockMessage("/token set", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/token set", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/token remove", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/token remove", TEST_USERS.accountant));

        expect(mockBot.popResults()).toEqual([
            "service\\.token\\.set",
            "service\\.token\\.exists",
            "service\\.token\\.removed",
            "service\\.token\\.missing",
        ]);
    });

    test("/token is restricted for guests", async () => {
        await mockBot.processUpdate(createMockMessage("/token set", TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual(["general\\.errors\\.restricted"]);
    });

    test("/chatid reports the chat's id", async () => {
        await mockBot.processUpdate(createMockMessage("/chatid", TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual([`chatId: ${TEST_USERS.guest.userid}`]);
    });

    test("/tldr is not ready outside NonTopicChats", async () => {
        await mockBot.processUpdate(createMockMessage("/tldr today", TEST_USERS.admin));

        expect(mockBot.popResults()).toEqual(["service\\.tldr\\.notready"]);
    });

    test("/tldr shows help for a bare command and for a count over the limit", async () => {
        await mockBot.processUpdate(createMockMessage("/tldr", TEST_USERS.admin, Date.now(), TLDR_CHAT_ID));
        await mockBot.processUpdate(createMockMessage("/tldr 5000", TEST_USERS.admin, Date.now(), TLDR_CHAT_ID));

        expect(mockBot.popResults()).toEqual(["service\\.tldr\\.help", "service\\.tldr\\.help"]);
    });

    test("/tldr reports emptiness for time-window tokens when there is no history", async () => {
        const tokens = ["today", "yesterday", "day", "week", "2h", "30m", "2h30m"];

        for (const token of tokens) {
            await mockBot.processUpdate(createMockMessage(`/tldr ${token}`, TEST_USERS.admin, Date.now(), TLDR_CHAT_ID));
        }

        expect(mockBot.popResults()).toEqual(tokens.map(() => "service\\.tldr\\.empty"));
    });

    test("/digest is restricted for guests", async () => {
        await mockBot.processUpdate(createMockMessage("/digest", TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual(["general\\.errors\\.restricted"]);
    });

    test("/digest is not ready outside NonTopicChats", async () => {
        await mockBot.processUpdate(createMockMessage("/digest", TEST_USERS.accountant, Date.now(), botConfig.chats.offtopic));

        expect(mockBot.popResults()).toEqual(["service\\.tldr\\.notready"]);
    });

    test("/digest run by a trusted member reports emptiness for its own chat's history", async () => {
        await mockBot.processUpdate(createMockMessage("/digest", TEST_USERS.accountant, Date.now(), TLDR_CHAT_ID));

        expect(mockBot.popResults()).toEqual(["service\\.tldr\\.empty"]);
    });

    test("/digest run from cron (msg = null) stays silent when main chat has no history for yesterday", async () => {
        await ServiceController.sendDailyDigestHandler(mockBot, null);

        expect(mockBot.popResults()).toEqual([]);
    });
});
