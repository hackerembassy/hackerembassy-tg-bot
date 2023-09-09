import fundsRepository from "../../repositories/fundsRepository";
import { sleep } from "../../utils/common";
import { HackerEmbassyBotMock } from "../mocks/HackerEmbassyBotMock";
import { cleanDb, createBotMock, createMockMessage, prepareDb } from "../mocks/mockHelpers";

describe("HackerEmbassyBotMock", () => {
    const botMock: HackerEmbassyBotMock = createBotMock();

    beforeAll(async () => {
        prepareDb();
        jest.useFakeTimers({ doNotFake: ["setTimeout"] });

        await sleep(100);
    });

    afterEach(() => fundsRepository.clearFunds());

    afterAll(() => {
        jest.useRealTimers();
        cleanDb();
    });

    test("fund is properly added by /addfund and displayed by /funds", async () => {
        await botMock.processUpdate(createMockMessage("/funds", "user"));
        await botMock.processUpdate(createMockMessage("/addfund Test_Fund with target 500 USD"));
        await botMock.processUpdate(createMockMessage("/funds", "user"));

        await Promise.resolve(process.nextTick);

        const results = botMock.popResults();

        expect(results).toEqual([
            "funds\\.funds",
            "funds\\.addfund\\.success",
            "funds\\.funds🟠 Test\\_Fund \\- funds\\.fund\\.collected 0 funds\\.fund\\.from 500 USD\n\n",
        ]);
    });

    test("donations are properly added by /adddonation and displayed by /funds", async () => {
        await botMock.processUpdate(createMockMessage("/addfund Test_Fund_With_Donations with target 500 USD"));
        await botMock.processUpdate(createMockMessage("/adddonation 5000 USD from @user1 to Test_Fund_With_Donations"));
        await botMock.processUpdate(createMockMessage("/funds", "user"));

        await jest.runAllTimersAsync();

        const results = botMock.popResults();

        expect(results).toEqual([
            "funds\\.addfund\\.success",
            "funds\\.adddonation\\.success",
            "funds\\.funds🟢 Test\\_Fund\\_With\\_Donations \\- funds\\.fund\\.collected 5000 funds\\.fund\\.from 500 USD\n      [user1](t\\.me/user1) \\- 5000 USD\n\n",
        ]);
    });
});
