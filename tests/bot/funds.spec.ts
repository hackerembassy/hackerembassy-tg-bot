import fundsRepository from "@repositories/fundsRepository";

import { ACCOUNTANT_USER, ADMIN_USER, prepareDb } from "../dbSetup";
import { HackerEmbassyBotMock } from "../mocks/HackerEmbassyBotMock";
import { createMockBot, createMockMessage } from "../mocks/mockHelpers";

describe("Bot Funds commands:", () => {
    const mockBot: HackerEmbassyBotMock = createMockBot();
    const mockRentFund = "Аренда Январь 2023";

    beforeAll(() => {
        prepareDb();
    });

    afterEach(() => fundsRepository.clearFunds());

    test("/addfund should properly add a fund to a list returned by /funds", async () => {
        await mockBot.processUpdate(createMockMessage("/funds"));
        await mockBot.processUpdate(createMockMessage("/addfund Test_Fund with target 500 USD", ADMIN_USER));
        await mockBot.processUpdate(createMockMessage("/funds"));

        const results = mockBot.popResults();

        expect(results).toEqual([
            "funds\\.funds",
            "funds\\.addfund\\.success",
            "funds\\.funds🟠 Test\\_Fund \\- funds\\.fund\\.collected 0 funds\\.fund\\.from 500 USD\n\n",
        ]);
    });

    test("/adddonation should properly add a donation to an added fund to a list returned by /funds", async () => {
        await mockBot.processUpdate(createMockMessage("/addfund Test_Fund_With_Donations with target 500 USD", ADMIN_USER));

        await mockBot.processUpdate(
            createMockMessage("/adddonation 5000 USD from @user1 to Test_Fund_With_Donations", ADMIN_USER)
        );

        await mockBot.processUpdate(createMockMessage("/funds"));

        expect(mockBot.popResults()).toEqual([
            "funds\\.addfund\\.success",
            "funds\\.adddonation\\.success",
            "funds\\.funds🟢 Test\\_Fund\\_With\\_Donations \\- funds\\.fund\\.collected 5000 funds\\.fund\\.from 500 USD\n      [user1](t\\.me/user1) \\- 5000 USD\n\n",
        ]);
    });

    test("/costs should allow only accountants to add costs", async () => {
        fundsRepository.addFund(mockRentFund, 1000);

        await mockBot.processUpdate(createMockMessage("/costs 50 USD from @user1"));
        await mockBot.processUpdate(createMockMessage("/costs 50 USD from @user1", ACCOUNTANT_USER));

        expect(mockBot.popResults()).toEqual(["funds\\.fund\\.text", "funds\\.adddonation\\.success"]);

        fundsRepository.removeFund(mockRentFund);
    });
});
