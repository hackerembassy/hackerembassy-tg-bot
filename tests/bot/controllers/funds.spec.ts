import { InlineKeyboardMarkup, Message } from "node-telegram-bot-api";

import fundsRepository from "@data/repositories/funds";
import { TEST_USERS } from "@data/seed";
import * as ExportHelper from "@services/domain/funds/reports";

import { SendPhotoOptions } from "@hackembot/core/types";

import { createMockBot, createMockMessage, HackerEmbassyBotMock } from "../../mocks/bot";

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
            "funds\\.funds🟠 `Test\\_Fund` \\- funds\\.fund\\.collected 0 funds\\.fund\\.from 500 USD\n\n",
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
            "funds\\.funds🟢 `Test\\_Fund\\_With\\_Donations` \\- funds\\.fund\\.collected 5000 funds\\.fund\\.from 500 USD\n      [guest](t\\.me/guest) \\- 5000 USD\n\n",
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

    test("/residentscosts lists residents against the current costs fund, filtered by option", async () => {
        fundsRepository.addFund(mockRentFund);

        await mockBot.processUpdate(
            createMockMessage(
                `/adddonation 100 USD from @${TEST_USERS.accountant.username} to ${mockRentFund.name}`,
                TEST_USERS.admin
            )
        );

        await mockBot.processUpdate(createMockMessage("/residentscosts paid", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/residentscosts left", TEST_USERS.accountant));

        const [, paidList, leftList] = mockBot.popResults();

        expect(paidList).toContain("accountant");
        expect(paidList).not.toContain("admin");
        expect(leftList).toContain("admin");
        expect(leftList).not.toContain("accountant");

        fundsRepository.removeFundByName(mockRentFund.name);
    });

    test("/rmonth lists residents by donation status for the current month, filtered by option", async () => {
        await mockBot.processUpdate(createMockMessage("/addfund Rmonth_Fund with target 500 USD", TEST_USERS.admin));
        await mockBot.processUpdate(
            createMockMessage(`/adddonation 100 USD from @${TEST_USERS.accountant.username} to Rmonth_Fund`, TEST_USERS.admin)
        );
        mockBot.popResults();

        await mockBot.processUpdate(createMockMessage("/rmonth paid", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/rmonth left", TEST_USERS.accountant));

        const [paidList, leftList] = mockBot.popResults();

        expect(paidList).toContain("accountant");
        expect(paidList).not.toContain("admin");
        expect(leftList).toContain("admin");
        expect(leftList).not.toContain("accountant");
    });

    test("/refreshsponsors recalculates sponsorship levels from recent donations", async () => {
        await mockBot.processUpdate(createMockMessage("/addfund Sponsor_Fund with target 500 USD", TEST_USERS.admin));
        await mockBot.processUpdate(
            createMockMessage(`/adddonation 5000 USD from @${TEST_USERS.guest.username} to Sponsor_Fund`, TEST_USERS.admin)
        );
        mockBot.popResults();

        await mockBot.processUpdate(createMockMessage("/refreshsponsors", TEST_USERS.accountant));

        expect(mockBot.popResults()).toEqual(["funds\\.refreshsponsorships\\.success"]);
    });

    describe("/fund with autodonuts", () => {
        type SentPhoto = [number, unknown, SendPhotoOptions];

        let renderSpy: jest.SpyInstance<Promise<Buffer>>;
        let sendPhotoSpy: jest.SpyInstance<Promise<Message>, SentPhoto>;
        let editMediaSpy: jest.SpiedFunction<typeof mockBot.editMessageMedia>;
        let deleteSpy: jest.SpiedFunction<typeof mockBot.deleteMessage>;
        let uploads = 0;

        beforeEach(() => {
            mockBot.botState.fileIdCache.clear();
            mockBot.popResults();
            uploads = 0;

            renderSpy = jest.spyOn(ExportHelper, "renderFundDonut").mockResolvedValue(Buffer.from("donut"));
            editMediaSpy = jest.spyOn(mockBot, "editMessageMedia").mockImplementation((_media, form) =>
                Promise.resolve({
                    message_id: Number(form?.message_id),
                    date: 0,
                    chat: { id: Number(form?.chat_id), type: "private" },
                    photo: [{ file_id: `donut-file-${++uploads}`, file_unique_id: "u", width: 1, height: 1 }],
                } as Message)
            );
            deleteSpy = jest.spyOn(mockBot, "deleteMessage").mockResolvedValue(true);
            sendPhotoSpy = jest.spyOn(mockBot, "sendPhoto") as typeof sendPhotoSpy;
        });

        afterEach(() => jest.restoreAllMocks());

        const donutKeys = () => Object.keys(mockBot.botState.fileIdCache.toJSON()).filter(key => key.startsWith("donut:"));

        test("sends the fund as a photo caption, swaps the loader for a rendered donut, then reuses it", async () => {
            await addFundWithDonation(mockBot, "Donut_Fund");
            sendPhotoSpy.mockClear();

            await mockBot.processUpdate(createMockMessage("/fund Donut_Fund"));
            await waitFor(() => editMediaSpy.mock.calls.length === 1);

            expect(mockBot.popResults()).toEqual([
                "🟠 `Donut\\_Fund` \\- funds\\.fund\\.collected 100 funds\\.fund\\.from 500 USD\n      [guest](t\\.me/guest) \\- 100 USD",
            ]);
            expect(renderSpy).toHaveBeenCalledTimes(1);

            // real editPhoto: caption converted into the media object, donate button kept
            const [media, form] = editMediaSpy.mock.calls[0];
            expect(media).toMatchObject({ type: "photo", parse_mode: "MarkdownV2" });
            expect(media.caption).toContain("`Donut\\_Fund`");
            expect((form?.reply_markup as InlineKeyboardMarkup).inline_keyboard[0][0].text).toBe("basic.info.buttons.donate");

            const firstKeyboard = (sendPhotoSpy.mock.calls[0][2].reply_markup as InlineKeyboardMarkup).inline_keyboard;
            expect(firstKeyboard[0][0].text).toBe("basic.info.buttons.donate");
            expect(sendPhotoSpy.mock.calls[0][1]).toBe("./resources/images/donut_loader.jpg");

            await mockBot.processUpdate(createMockMessage("/fund Donut_Fund"));

            expect(renderSpy).toHaveBeenCalledTimes(1);
            expect(editMediaSpy).toHaveBeenCalledTimes(1);
            expect(sendPhotoSpy.mock.calls[1][1]).toBe("donut-file-1");
        });

        test("keeps static mode without buttons after the swap", async () => {
            await addFundWithDonation(mockBot, "Static_Fund");
            sendPhotoSpy.mockClear();

            await mockBot.processUpdate(createMockMessage("/fund Static_Fund -static"));
            await waitFor(() => editMediaSpy.mock.calls.length === 1);

            expect(sendPhotoSpy.mock.calls[0][2].reply_markup).toBeUndefined();
            expect(editMediaSpy.mock.calls[0][1]?.reply_markup).toEqual({ inline_keyboard: [] });
        });

        test("re-renders once a new donation changes the fund, keeping a single cache entry per fund", async () => {
            await addFundWithDonation(mockBot, "Changing_Fund");

            await mockBot.processUpdate(createMockMessage("/fund Changing_Fund"));
            await waitFor(() => editMediaSpy.mock.calls.length === 1);

            await mockBot.processUpdate(
                createMockMessage(`/adddonation 50 USD from @${TEST_USERS.admin.username} to Changing_Fund`, TEST_USERS.admin)
            );
            await mockBot.processUpdate(createMockMessage("/fund Changing_Fund"));
            await waitFor(() => editMediaSpy.mock.calls.length === 2);

            expect(renderSpy).toHaveBeenCalledTimes(2);
            expect(donutKeys()).toHaveLength(1);
        });

        test("replaces the loader with the text reply when rendering fails", async () => {
            await addFundWithDonation(mockBot, "Broken_Fund");
            renderSpy.mockRejectedValue(new Error("quickchart down"));

            await mockBot.processUpdate(createMockMessage("/fund Broken_Fund"));
            await waitFor(() => mockBot.popResults().includes("funds\\.fund\\.text"));

            expect(deleteSpy).toHaveBeenCalledTimes(1);
            expect(editMediaSpy).not.toHaveBeenCalled();
            expect(donutKeys()).toHaveLength(0);
        });

        test("forgets a rejected cached donut and renders it again", async () => {
            await addFundWithDonation(mockBot, "Stale_Fund");
            await mockBot.processUpdate(createMockMessage("/fund Stale_Fund"));
            await waitFor(() => editMediaSpy.mock.calls.length === 1);

            sendPhotoSpy.mockImplementationOnce(() => Promise.reject(new Error("Bad Request: wrong file identifier")));

            await mockBot.processUpdate(createMockMessage("/fund Stale_Fund"));
            await waitFor(() => editMediaSpy.mock.calls.length === 2);

            expect(renderSpy).toHaveBeenCalledTimes(2);
            expect(donutKeys()).toEqual([expect.stringContaining("donut:")]);
            expect(mockBot.botState.fileIdCache.toJSON()[donutKeys()[0]]).toBe("donut-file-2");
        });

        test("falls back to plain text for a fund without donations", async () => {
            await mockBot.processUpdate(createMockMessage("/addfund Empty_Fund with target 500 USD", TEST_USERS.admin));
            mockBot.popResults();

            await mockBot.processUpdate(createMockMessage("/fund Empty_Fund"));

            expect(mockBot.popResults()).toEqual(["funds\\.fund\\.text"]);
            expect(sendPhotoSpy).not.toHaveBeenCalled();
            expect(renderSpy).not.toHaveBeenCalled();
        });

        test("/donut without a fund name sends the loader with help", async () => {
            await mockBot.processUpdate(createMockMessage("/donut"));

            expect(mockBot.popResults()).toEqual(["funds\\.export\\.donuthelp"]);
            expect(sendPhotoSpy).toHaveBeenCalledTimes(1);
        });
    });
});

// Polls until fire-and-forget donut work settles
async function waitFor(check: () => boolean, timeoutMs = 2000) {
    const deadline = Date.now() + timeoutMs;

    while (!check()) {
        if (Date.now() > deadline) throw new Error("waitFor timed out");
        await new Promise(resolve => setTimeout(resolve, 10));
    }
}

async function addFundWithDonation(bot: HackerEmbassyBotMock, fundName: string) {
    await bot.processUpdate(createMockMessage(`/addfund ${fundName} with target 500 USD`, TEST_USERS.admin));
    await bot.processUpdate(
        createMockMessage(`/adddonation 100 USD from @${TEST_USERS.guest.username} to ${fundName}`, TEST_USERS.admin)
    );
    bot.popResults();
}
