import fundsRepository from "@data/repositories/funds";
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

    test("/addfund and /adddonation are restricted to accountants", async () => {
        await mockBot.processUpdate(createMockMessage("/addfund Guest_Fund with target 500 USD", TEST_USERS.guest));
        await mockBot.processUpdate(
            createMockMessage(`/adddonation 100 USD from @${TEST_USERS.guest.username} to Guest_Fund`, TEST_USERS.guest)
        );

        expect(mockBot.popResults()).toEqual(["general\\.errors\\.restricted", "general\\.errors\\.restricted"]);
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

    test("/closefund and /removefund manage a fund's lifecycle, restricted for non-accountants", async () => {
        await mockBot.processUpdate(createMockMessage("/addfund Lifecycle_Fund with target 100 USD", TEST_USERS.admin));
        await mockBot.processUpdate(createMockMessage("/closefund Lifecycle_Fund", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/closefund Lifecycle_Fund", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/removefund Lifecycle_Fund", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/removefund Lifecycle_Fund", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/funds"));

        expect(mockBot.popResults()).toEqual([
            "funds\\.addfund\\.success",
            "general\\.errors\\.restricted",
            "funds\\.closefund\\.success",
            "general\\.errors\\.restricted",
            "funds\\.removefund\\.success",
            "funds\\.funds",
        ]);
    });

    test("/removedonation and /changedonation are restricted to accountants and mutate donation records", async () => {
        await mockBot.processUpdate(createMockMessage("/addfund Donation_Edit_Fund with target 500 USD", TEST_USERS.admin));
        await mockBot.processUpdate(
            createMockMessage(`/adddonation 100 USD from @${TEST_USERS.guest.username} to Donation_Edit_Fund`, TEST_USERS.admin)
        );

        const donationId = fundsRepository.getDonationsForName("Donation_Edit_Fund")[0].id;

        await mockBot.processUpdate(createMockMessage(`/changedonation ${donationId} to 50 USD`, TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage(`/changedonation ${donationId} to 50 USD`, TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage(`/removedonation ${donationId}`, TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage(`/removedonation ${donationId}`, TEST_USERS.accountant));

        expect(mockBot.popResults()).toEqual([
            "funds\\.addfund\\.success",
            "funds\\.adddonation\\.success",
            "general\\.errors\\.restricted",
            "funds\\.changedonation\\.success",
            "general\\.errors\\.restricted",
            "funds\\.removedonation\\.success",
        ]);
        expect(fundsRepository.getDonationById(donationId)).toBeUndefined();
    });

    test("/debt exposes a user's donation history and is restricted to accountants", async () => {
        await mockBot.processUpdate(createMockMessage("/debt", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/debt", TEST_USERS.accountant));

        expect(mockBot.popResults()).toEqual(["general\\.errors\\.restricted", "funds\\.debt\\.empty"]);
    });

    test("/costs should allow only accountants to add costs", async () => {
        fundsRepository.addFund(mockRentFund);

        await mockBot.processUpdate(createMockMessage(`/costs 50 USD from @${TEST_USERS.guest.username}`));
        await mockBot.processUpdate(createMockMessage(`/costs 50 USD from @${TEST_USERS.guest.username}`, TEST_USERS.accountant));

        expect(mockBot.popResults()).toEqual(["funds\\.fund\\.text", "funds\\.adddonation\\.success"]);

        fundsRepository.removeFundByName(mockRentFund.name);
    });
});
