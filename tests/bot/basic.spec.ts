import { createMockBot, createMockMessage } from "../mocks/bot";

describe("Basic commands:", () => {
    const mockBot = createMockBot();

    test("should return correct info responses", async () => {
        await mockBot.processUpdate(createMockMessage(`/start`));
        await mockBot.processUpdate(createMockMessage(`/info`));
        await mockBot.processUpdate(createMockMessage(`/join`));
        await mockBot.processUpdate(createMockMessage(`/events`));
        await mockBot.processUpdate(createMockMessage(`/location`));

        expect(mockBot.popResults()).toEqual([
            "basic\\.start\\.text",
            "basic\\.info\\.text",
            "basic\\.join",
            "basic\\.events\\.calendar\nbasic\\.events\\.text",
            "basic\\.location\\.address",
        ]);
    });

    test("should return correct calendar responses", async () => {
        await mockBot.processUpdate(createMockMessage(`/today`));
        await mockBot.processUpdate(createMockMessage(`/upcoming`));

        expect(mockBot.popResults()).toEqual(["basic\\.events\\.notoday", "basic\\.events\\.upcoming\n"]);
    });

    test("should return correct crypto responses", async () => {
        const cryptoCommands = ["/btc", "/eth", "/usdt", "/usdc", "/trx", "/ton"];

        await Promise.all(
            cryptoCommands.map(async command => {
                await mockBot.processUpdate(createMockMessage(`${command}`));
            })
        );

        expect(mockBot.popResults()).toEqual(Array(cryptoCommands.length).fill("basic\\.donateCoin"));
    });

    test("should return correct donate responses", async () => {
        await mockBot.processUpdate(createMockMessage(`/donate`));
        await mockBot.processUpdate(createMockMessage(`/donatecash`));
        await mockBot.processUpdate(createMockMessage(`/donatecard`));
        await mockBot.processUpdate(createMockMessage(`/donatecrypto btc`));
        await mockBot.processUpdate(createMockMessage(`/donateequipment`));

        expect(mockBot.popResults()).toEqual([
            "basic\\.donate",
            "basic\\.donateCash",
            "basic\\.donateCard", // Yeah, now it's the same
            "basic\\.donateCoin",
            "basic\\.donateEquipment",
        ]);
    });
});
