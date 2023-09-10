import fundsRepository from "../../repositories/fundsRepository";
import { HackerEmbassyBotMock } from "../mocks/HackerEmbassyBotMock";
import { createBotMock, createMockMessage, prepareDb } from "../mocks/mockHelpers";

describe("Bot behavior shared for all commands:", () => {
    const botMock: HackerEmbassyBotMock = createBotMock();

    beforeAll(async () => {
        prepareDb();
        jest.useFakeTimers({ doNotFake: ["setTimeout"] });
    });

    afterEach(() => fundsRepository.clearFunds());

    afterAll(() => {
        jest.useRealTimers();
    });

    test("guest user should not be allowed to use protected commands", async () => {
        // guestuser is a default user
        await botMock.processUpdate(createMockMessage("/unlock"));
        await botMock.processUpdate(createMockMessage("/doorbell"));
        await botMock.processUpdate(createMockMessage("/webcam"));
        await botMock.processUpdate(createMockMessage("/webcam2"));
        await botMock.processUpdate(createMockMessage("/doorcam"));
        await botMock.processUpdate(createMockMessage("/superstatus"));
        await botMock.processUpdate(createMockMessage("/open"));
        await botMock.processUpdate(createMockMessage("/close"));
        await botMock.processUpdate(createMockMessage("/setemoji"));
        await botMock.processUpdate(createMockMessage("/enableresidentmenu"));
        await botMock.processUpdate(createMockMessage("/inforce telegram_username"));
        await botMock.processUpdate(createMockMessage("/outforce telegram_username"));
        await botMock.processUpdate(createMockMessage("/evict"));
        await botMock.processUpdate(createMockMessage("/residentsdonated"));

        // Admin commands
        await botMock.processUpdate(createMockMessage("/getusers"));
        await botMock.processUpdate(createMockMessage("/adduser telegram_username as user_role1|user_role2|user_role3"));
        await botMock.processUpdate(createMockMessage("/removeuser telegram_username"));
        await botMock.processUpdate(createMockMessage("/updateroles of telegram_username to user_role1|user_role2|user_role3"));
        await botMock.processUpdate(createMockMessage("/forcebirthdaywishes"));
        await botMock.processUpdate(createMockMessage("/forward some_text"));
        await botMock.processUpdate(createMockMessage("/getlogs"));

        // Accountant commands
        await botMock.processUpdate(createMockMessage("/costs 50 USD from telegram_username"));
        await botMock.processUpdate(createMockMessage("/addfund Fund_Name with target 500 USD"));
        await botMock.processUpdate(createMockMessage("/updatefund Fund_Name with target 500 USD as Fund_Name"));
        await botMock.processUpdate(createMockMessage("/changefundstatus of Fund_Name to pending"));
        await botMock.processUpdate(createMockMessage("/adddonation 5 USD from telegram_username to Fund_Name"));
        await botMock.processUpdate(createMockMessage("/changedonation 1 to 55 USD"));
        await botMock.processUpdate(createMockMessage("/removedonation 1"));
        await botMock.processUpdate(createMockMessage("/transferdonation 1 to username"));
        await botMock.processUpdate(createMockMessage("/closefund Fund_Name"));
        await botMock.processUpdate(createMockMessage("/removefund Fund_Name"));

        await Promise.resolve(process.nextTick);

        expect(botMock.popResults()).toEqual(Array(31).fill("admin\\.messages\\.restricted"));
    });
});
