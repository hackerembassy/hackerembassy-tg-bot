import fundsRepository from "@repositories/funds";
import { TEST_USERS } from "@data/seed";

import { createMockBot, createMockMessage } from "../mocks/bot";

describe("Bot Funds commands:", () => {
    const mockBot = createMockBot();
    const mockRentFund = {
        name: "Аренда Январь 2023",
        target_value: 1000,
        target_currency: "USD",
        status: "open",
    };

    afterEach(() => fundsRepository.clearFunds());

    test("/addfund should properly add a fund to a list returned by /funds", async () => {
        await mockBot.processUpdate(createMockMessage("/funds"));
        await mockBot.processUpdate(createMockMessage("/addfund Test_Fund with target 500 USD", TEST_USERS.admin));
        await mockBot.processUpdate(createMockMessage("/funds"));

        const results = mockBot.popResults();

        expect(results).toEqual([
            "funds\\.funds",
            "funds\\.addfund\\.success",
            "funds\\.funds🟠 Test\\_Fund \\- funds\\.fund\\.collected 0 funds\\.fund\\.from 500 USD\n\n",
        ]);
    });

    test("/adddonation should properly add a donation to an added fund to a list returned by /funds", async () => {
        await mockBot.processUpdate(createMockMessage("/addfund Test_Fund_With_Donations with target 500 USD", TEST_USERS.admin));

        await mockBot.processUpdate(
            createMockMessage(
                `/adddonation 5000 USD from @${TEST_USERS.guest.username} to Test_Fund_With_Donations`,
                TEST_USERS.admin
            )
        );

        await mockBot.processUpdate(createMockMessage("/funds"));

        expect(mockBot.popResults()).toEqual([
            "funds\\.addfund\\.success",
            "funds\\.adddonation\\.success\nfunds\\.adddonation\\.sponsorship",
            "funds\\.funds🟢 Test\\_Fund\\_With\\_Donations \\- funds\\.fund\\.collected 5000 funds\\.fund\\.from 500 USD\n      [guest](t\\.me/guest) \\- 5000 USD\n\n",
        ]);
    });

    test("/costs should allow only accountants to add costs", async () => {
        fundsRepository.addFund(mockRentFund);

        await mockBot.processUpdate(createMockMessage(`/costs 50 USD from @${TEST_USERS.guest.username}`));
        await mockBot.processUpdate(createMockMessage(`/costs 50 USD from @${TEST_USERS.guest.username}`, TEST_USERS.accountant));

        expect(mockBot.popResults()).toEqual(["funds\\.fund\\.text", "funds\\.adddonation\\.success"]);

        fundsRepository.removeFundByName(mockRentFund.name);
    });
});
