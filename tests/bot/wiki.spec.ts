import wiki from "@services/external/wiki";

import { createMockBot, createMockMessage } from "../mocks/bot";

describe("Bot Wiki commands:", () => {
    const mockBot = createMockBot();

    afterEach(() => jest.clearAllMocks());

    test("/wiki with no path shows the top-level page list", async () => {
        await mockBot.processUpdate(createMockMessage("/wiki"));

        expect(mockBot.popResults()).toEqual(["wiki\\.help"]);
    });

    test("/wiki reports a page that doesn't exist", async () => {
        await mockBot.processUpdate(createMockMessage("/wiki nonexistent-page"));

        expect(mockBot.popResults()).toEqual(["wiki\\.page\\.notfound"]);
    });

    test("/wiki shows a found page's content", async () => {
        (wiki.findTreeNode as jest.Mock).mockResolvedValueOnce({
            node: { id: 1, children: [] },
            path: "getting-started",
        });
        (wiki.getPageContent as jest.Mock).mockResolvedValueOnce("Welcome to the space wiki");

        await mockBot.processUpdate(createMockMessage("/wiki getting-started"));

        expect(mockBot.popResults()).toEqual(["Welcome to the space wiki"]);
    });
});
