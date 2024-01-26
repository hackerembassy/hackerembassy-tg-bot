import fundsRepository from "../../repositories/fundsRepository";
import { sleep } from "../../utils/common";
import { HackerEmbassyBotMock } from "../mocks/HackerEmbassyBotMock";
import { ADMIN_USER_NAME, createBotMock, createMockMessage, prepareDb } from "../mocks/mockHelpers";

describe("Bot Funds commands:", () => {
    const botMock: HackerEmbassyBotMock = createBotMock();

    beforeAll(() => {
        prepareDb();
        jest.useFakeTimers({ advanceTimers: 1, doNotFake: ["setTimeout"] });
    });

    afterEach(() => fundsRepository.clearFunds());

    test("/addfund should properly add a fund to a list returned by /funds", async () => {
        await botMock.processUpdate(createMockMessage("/funds"));
        await botMock.processUpdate(createMockMessage("/addfund Test_Fund with target 500 USD", ADMIN_USER_NAME));
        await botMock.processUpdate(createMockMessage("/funds"));

        await jest.runAllTimersAsync();

        const results = botMock.popResults();

        expect(results).toEqual([
            "funds\\.funds",
            "funds\\.addfund\\.success",
            "funds\\.funds🟠 Test\\_Fund \\- funds\\.fund\\.collected 0 funds\\.fund\\.from 500 USD\n\n",
        ]);
    });

    test("/adddonation should properly add a donation to an added fund to a list returned by /funds", async () => {
        await botMock.processUpdate(createMockMessage("/addfund Test_Fund_With_Donations with target 500 USD", ADMIN_USER_NAME));
        await botMock.processUpdate(
            createMockMessage("/adddonation 5000 USD from @user1 to Test_Fund_With_Donations", ADMIN_USER_NAME)
        );
        // Send photo delay
        await sleep(100);
        await botMock.processUpdate(createMockMessage("/funds"));
        await jest.runAllTimersAsync();

        expect(botMock.popResults()).toEqual([
            "funds\\.addfund\\.success",
            "funds\\.adddonation\\.success",
            "funds\\.funds🟢 Test\\_Fund\\_With\\_Donations \\- funds\\.fund\\.collected 5000 funds\\.fund\\.from 500 USD\n      [user1](t\\.me/user1) \\- 5000 USD\n\n",
        ]);
    });
});
