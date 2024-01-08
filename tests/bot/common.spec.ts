import { IGNORE_UPDATE_TIMEOUT } from "../../bot/core/HackerEmbassyBot";
import fundsRepository from "../../repositories/fundsRepository";
import { HackerEmbassyBotMock } from "../mocks/HackerEmbassyBotMock";
import { ADMIN_USER_NAME, createBotMock, createMockMessage, GUEST_USER_NAME, prepareDb } from "../mocks/mockHelpers";

describe("Bot behavior shared for all commands:", () => {
    const botMock: HackerEmbassyBotMock = createBotMock();
    const mockDate = new Date("2023-01-01");

    beforeAll(() => {
        prepareDb();
        jest.useFakeTimers({ advanceTimers: 1, doNotFake: ["setTimeout"] }).setSystemTime(mockDate);
    });

    afterEach(() => fundsRepository.clearFunds());

    test("old messages should be ignored", async () => {
        await botMock.processUpdate(createMockMessage("/status", GUEST_USER_NAME, mockDate.getTime() - 10000));

        await jest.advanceTimersByTimeAsync(IGNORE_UPDATE_TIMEOUT);

        expect(botMock.popResults()).toHaveLength(0);
    });

    test("bot should respond to messages when it is mentioned", async () => {
        await botMock.processUpdate(createMockMessage(`/status@${botMock.Name}`));
        await botMock.processUpdate(createMockMessage(`/status@${botMock.Name} short`));

        await jest.runAllTimersAsync();

        expect(botMock.popResults()).toHaveLength(2);
    });

    test("bot should respond to commands with any case and not miss parameters", async () => {
        await botMock.processUpdate(createMockMessage(`/StAtUs`));
        await botMock.processUpdate(createMockMessage(`/status`));
        await botMock.processUpdate(createMockMessage(`/inForce abc`, ADMIN_USER_NAME));

        await jest.runAllTimersAsync();

        expect(botMock.popResults()).toHaveLength(3);
    });

    test("bot should not respond to messages when another bot is mentioned", async () => {
        await botMock.processUpdate(createMockMessage(`/status@${botMock.Name}1`));
        await botMock.processUpdate(createMockMessage(`/status@${botMock.Name}1 short`));

        await jest.runAllTimersAsync();

        expect(botMock.popResults()).toHaveLength(0);
    });

    test("bot should not respond to messages without a forward slash in the beginning", async () => {
        await botMock.processUpdate(createMockMessage(`+status`));
        await botMock.processUpdate(createMockMessage(`status`));
        await botMock.processUpdate(createMockMessage(` status`));
        await botMock.processUpdate(createMockMessage(`abc /status`));
        await botMock.processUpdate(createMockMessage(`+status short`));

        await jest.runAllTimersAsync();

        expect(botMock.popResults()).toHaveLength(0);
    });

    test("commands with the silent modifier should produce no output", async () => {
        await botMock.processUpdate(createMockMessage("/status -silent"));

        await jest.runAllTimersAsync();

        expect(botMock.popResults()).toHaveLength(0);
    });

    test("guest user should not be allowed to use protected commands", async () => {
        const protectedCommands = [
            "/unlock",
            "/doorbell",
            "/downstairs",
            "/upstairs",
            "/addtopic test_topic test_description",
            "/removetopic test_topic",
            "/jigglycam",
            "/outdoors",
            "/printerscam",
            "/superstatus",
            "/open",
            "/close",
            "/setemoji",
            "/enableresidentmenu",
            "/inforce telegram_username",
            "/outforce telegram_username",
            "/evict",
            "/residentsdonated",
            "/getusers",
            "/adduser telegram_username as user_role1|user_role2|user_role3",
            "/removeuser telegram_username",
            "/updateroles of telegram_username to user_role1|user_role2|user_role3",
            "/forcebirthdaywishes",
            "/forward some_text",
            "/getlogs",
            "/costs 50 USD from telegram_username",
            "/addfund Fund_Name with target 500 USD",
            "/updatefund Fund_Name with target 500 USD as Fund_Name",
            "/changefundstatus of Fund_Name to pending",
            "/adddonation 5 USD from telegram_username to Fund_Name",
            "/changedonation 1 to 55 USD",
            "/removedonation 1",
            "/transferdonation 1 to username",
            "/closefund Fund_Name",
            "/removefund Fund_Name",
        ];

        for (const command of protectedCommands) {
            await botMock.processUpdate(createMockMessage(command));
        }

        await jest.runAllTimersAsync();
        const expectedForbiddenResponses = Array(protectedCommands.length).fill("admin\\.messages\\.restricted");

        expect(botMock.popResults()).toEqual(expectedForbiddenResponses);
    });
});
