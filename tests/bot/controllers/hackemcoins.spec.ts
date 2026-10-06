import { Update } from "node-telegram-bot-api";

import fundsRepository from "@data/repositories/funds";
import hackemcoinsRepository from "@data/repositories/hackemcoins";
import { TEST_USERS } from "@data/seed";
import broadcast, { BroadcastEvents } from "@services/common/broadcast";
import { hackemcoinsService } from "@services/domain/hackemcoins";
import { fundsService } from "@services/domain/funds";
import { convertCurrency } from "@services/domain/funds/currency";
import { addDomainListeners } from "@services/listeners";
import { addBotListeners } from "@hackembot/listeners";

import { createMockBot, createMockMessage } from "../../mocks/bot";

const guestBalance = () => hackemcoinsService.getBalance(TEST_USERS.guest.userid);

function withTextMention(update: Update, mentionText: string, user: { userid: number }, lastOccurrence = false): Update {
    const text = update.message!.text!;
    const offset = lastOccurrence ? text.lastIndexOf(mentionText) : text.indexOf(mentionText);
    const entity = { type: "text_mention" as const, offset, length: mentionText.length };

    update.message!.entities = [
        ...(update.message!.entities ?? []),
        { ...entity, user: { id: user.userid, is_bot: false, first_name: mentionText } },
    ];

    return update;
}

describe("Bot Hackemcoins commands:", () => {
    const mockBot = createMockBot();
    // The sponsorship line is only appended on a user's first donation in the process
    const popFirstLines = () => mockBot.popResults().map(result => result.split("\n")[0]);

    afterEach(() => mockBot.popResults());

    test("/hackemcoins shows the sender's balance and help to anyone", async () => {
        await mockBot.processUpdate(createMockMessage("/hackemcoins"));
        await mockBot.processUpdate(createMockMessage("/hc", TEST_USERS.tenant));

        expect(mockBot.popResults()).toEqual(["hackemcoins\\.balance\\.text", "hackemcoins\\.balance\\.text"]);
    });

    test("/hackemcoins of another user is only available to residents", async () => {
        await mockBot.processUpdate(createMockMessage(`/hackemcoins @${TEST_USERS.accountant.username}`, TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage(`/hackemcoins @${TEST_USERS.guest.username}`, TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/hackemcoins nobody_here", TEST_USERS.accountant));

        expect(mockBot.popResults()).toEqual([
            "general\\.errors\\.restricted",
            "hackemcoins\\.balance\\.of",
            "general\\.errors\\.nouser",
        ]);
    });

    test("/granthc and /deducthc are restricted to residents", async () => {
        await mockBot.processUpdate(createMockMessage("/granthc 50 to guest for nothing", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/deducthc 50 from accountant for nothing", TEST_USERS.tenant));

        expect(mockBot.popResults()).toEqual(["general\\.errors\\.restricted", "general\\.errors\\.restricted"]);
    });

    test("/granthc credits the user, logs it to the logbook and notifies the recipient", async () => {
        const before = guestBalance();

        await mockBot.processUpdate(
            createMockMessage(`/granthc 50 to @${TEST_USERS.guest.username} for fixed the printer`, TEST_USERS.accountant)
        );

        expect(mockBot.popResults()).toEqual([
            "hackemcoins\\.grant\\.success",
            "hackemcoins\\.grant\\.log",
            "hackemcoins\\.received\\.grant",
        ]);
        expect(guestBalance()).toBe(before + 50);
        expect(hackemcoinsService.getHistory(TEST_USERS.guest.userid, 1)[0]).toMatchObject({
            type: "grant",
            amount: 50,
            reason: "fixed the printer",
            actor_id: TEST_USERS.accountant.userid,
        });
    });

    test("/deducthc debits the user without notifying them and may go below zero", async () => {
        const before = guestBalance();

        await mockBot.processUpdate(createMockMessage(`/deducthc ${before + 10} from guest for mistake`, TEST_USERS.accountant));

        expect(mockBot.popResults()).toEqual(["hackemcoins\\.deduct\\.success", "hackemcoins\\.deduct\\.log"]);
        expect(guestBalance()).toBe(-10);

        await mockBot.processUpdate(createMockMessage("/granthc 10 to guest for evening out", TEST_USERS.admin));
        expect(guestBalance()).toBe(0);
    });

    test("residents can grant to themselves without a direct message", async () => {
        const before = hackemcoinsService.getBalance(TEST_USERS.accountant.userid);

        await mockBot.processUpdate(createMockMessage("/granthc 5 to accountant for bought tea", TEST_USERS.accountant));

        expect(mockBot.popResults()).toEqual(["hackemcoins\\.grant\\.success", "hackemcoins\\.grant\\.log"]);
        expect(hackemcoinsService.getBalance(TEST_USERS.accountant.userid)).toBe(before + 5);
    });

    test("/granthc validates its input", async () => {
        await mockBot.processUpdate(createMockMessage("/granthc", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/granthc 50 to guest", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/deducthc", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/granthc 0 to guest for nothing", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/granthc 5 to nobody_here for nothing", TEST_USERS.accountant));

        expect(mockBot.popResults()).toEqual([
            "hackemcoins\\.grant\\.help",
            "hackemcoins\\.grant\\.help",
            "hackemcoins\\.deduct\\.help",
            "hackemcoins\\.errors\\.amount",
            "general\\.errors\\.nouser",
        ]);
    });

    test("/granthc resolves a multiword text mention to the mentioned user", async () => {
        const before = guestBalance();

        await mockBot.processUpdate(
            withTextMention(
                createMockMessage("/granthc 7 to Guest Person for helped out", TEST_USERS.accountant),
                "Guest Person",
                TEST_USERS.guest
            )
        );

        expect(mockBot.popResults()[0]).toBe("hackemcoins\\.grant\\.success");
        expect(guestBalance()).toBe(before + 7);
    });

    test("a text mention wins over a username equal to its display text", async () => {
        const adminBefore = hackemcoinsService.getBalance(TEST_USERS.admin.userid);
        const before = guestBalance();

        await mockBot.processUpdate(
            withTextMention(createMockMessage("/granthc 3 to admin for tea", TEST_USERS.accountant), "admin", TEST_USERS.guest)
        );

        expect(guestBalance()).toBe(before + 3);
        expect(hackemcoinsService.getBalance(TEST_USERS.admin.userid)).toBe(adminBefore);
    });

    test("a text mention in the reason is not taken as the recipient", async () => {
        const before = guestBalance();

        await mockBot.processUpdate(
            withTextMention(
                createMockMessage("/granthc 5 to @nobody_here for helped Guest Person", TEST_USERS.accountant),
                "Guest Person",
                TEST_USERS.guest
            )
        );

        expect(mockBot.popResults()).toEqual(["general\\.errors\\.nouser"]);
        expect(guestBalance()).toBe(before);
    });

    test("a reason mention with the recipient's display text doesn't redirect the coins", async () => {
        const adminBefore = hackemcoinsService.getBalance(TEST_USERS.admin.userid);
        const before = guestBalance();

        await mockBot.processUpdate(
            withTextMention(
                createMockMessage("/granthc 7 to guest for helped guest", TEST_USERS.accountant),
                "guest",
                TEST_USERS.admin,
                true
            )
        );

        expect(guestBalance()).toBe(before + 7);
        expect(hackemcoinsService.getBalance(TEST_USERS.admin.userid)).toBe(adminBefore);
    });

    test("/granthc rejects an overlong reason without changing the balance", async () => {
        const before = guestBalance();

        await mockBot.processUpdate(createMockMessage(`/granthc 1 to guest for ${"x".repeat(501)}`, TEST_USERS.accountant));

        expect(mockBot.popResults()).toEqual(["hackemcoins\\.errors\\.reason"]);
        expect(guestBalance()).toBe(before);
    });

    test("/hackemcoins shows the balance of a multiword text mention", async () => {
        await mockBot.processUpdate(
            withTextMention(createMockMessage("/hc Guest Person", TEST_USERS.accountant), "Guest Person", TEST_USERS.guest)
        );

        expect(mockBot.popResults()).toEqual(["hackemcoins\\.balance\\.of"]);
    });

    test("/hchistory lists the sender's latest transactions", async () => {
        await mockBot.processUpdate(createMockMessage("/hchistory", TEST_USERS.tenant));
        await mockBot.processUpdate(createMockMessage("/hchistory", TEST_USERS.guest));

        const [empty, history] = mockBot.popResults();

        expect(empty).toBe("hackemcoins\\.history\\.empty");
        expect(history).toMatch(/^hackemcoins\\\.history\\\.title\n/);
        expect(history).toContain("hackemcoins\\.history\\.types\\.grant");
        expect(history).toContain("hackemcoins\\.history\\.types\\.deduct");
    });

    test("/hchistory splits a history longer than one Telegram message", async () => {
        for (let i = 0; i < 10; i++)
            hackemcoinsService.grant(TEST_USERS.tenant, TEST_USERS.admin, 1, `${i} ${"long reason ".repeat(50)}`);

        await mockBot.processUpdate(createMockMessage("/hchistory", TEST_USERS.tenant));

        expect(mockBot.popResults().length).toBeGreaterThan(1);
    });

    test("/hchistory shows markup characters in reasons literally", async () => {
        hackemcoinsService.grant(TEST_USERS.admin, TEST_USERS.accountant, 1, "#*bold");

        await mockBot.processUpdate(createMockMessage("/hchistory", TEST_USERS.admin));

        expect(mockBot.popResults()[0]).toContain(String.raw`\#\*bold`);
    });

    test("/me shows the hackemcoin balance", async () => {
        await mockBot.processUpdate(createMockMessage("/me", TEST_USERS.guest));

        expect(mockBot.popResults()[0]).toContain("status\\.profile\\.hackemcoins");
    });

    describe("donation rewards", () => {
        const fundName = "Hackemcoin_Fund";

        beforeAll(() => {
            addDomainListeners();
            addBotListeners(mockBot);
        });

        beforeEach(() =>
            fundsRepository.addFund({ name: fundName, target_value: 100000, target_currency: "AMD", status: "open" })
        );

        afterEach(() => {
            for (const donation of fundsRepository.getDonationsForName(fundName)) fundsRepository.removeDonationById(donation.id);
            fundsRepository.removeFundByName(fundName);
        });

        test("a donation credits its percentage in hackemcoins and notifies the donor", async () => {
            const before = guestBalance();

            await mockBot.processUpdate(
                createMockMessage(`/adddonation 5000 AMD from guest to ${fundName}`, TEST_USERS.accountant)
            );

            expect(popFirstLines()).toEqual(["hackemcoins\\.received\\.donation", "funds\\.adddonation\\.success"]);
            expect(guestBalance()).toBe(before + 50);
        });

        test("small donations worth less than a coin are rounded down to nothing", async () => {
            const before = guestBalance();

            await mockBot.processUpdate(
                createMockMessage(`/adddonation 199 AMD from guest to ${fundName}`, TEST_USERS.accountant)
            );

            expect(popFirstLines()).toEqual(["hackemcoins\\.received\\.donation", "funds\\.adddonation\\.success"]);
            expect(guestBalance()).toBe(before + 1);

            await mockBot.processUpdate(
                createMockMessage(`/adddonation 99 AMD from guest to ${fundName}`, TEST_USERS.accountant)
            );

            expect(popFirstLines()).toEqual(["funds\\.adddonation\\.increased"]);
            expect(guestBalance()).toBe(before + 1);
        });

        test("/changedonation and /removedonation re-sync the reward without logbook entries", async () => {
            const before = guestBalance();
            const { donationId } = await fundsService.donate(fundName, 5000, "AMD", TEST_USERS.guest, TEST_USERS.accountant);

            await mockBot.processUpdate(createMockMessage(`/changedonation ${donationId} to 8000 AMD`, TEST_USERS.accountant));
            expect(guestBalance()).toBe(before + 80);

            await mockBot.processUpdate(createMockMessage(`/changedonation ${donationId} to 8000 AMD`, TEST_USERS.accountant));
            await mockBot.processUpdate(createMockMessage(`/removedonation ${donationId}`, TEST_USERS.accountant));
            expect(guestBalance()).toBe(before);

            expect(popFirstLines()).toEqual([
                "hackemcoins\\.received\\.donation",
                "funds\\.changedonation\\.success",
                "funds\\.changedonation\\.success",
                "funds\\.removedonation\\.success",
            ]);
        });

        test("a failed currency conversion leaves the existing reward untouched", async () => {
            const before = guestBalance();
            const { donationId } = await fundsService.donate(fundName, 5000, "AMD", TEST_USERS.guest, TEST_USERS.accountant);

            // eslint-disable-next-line unicorn/no-useless-undefined -- mockResolvedValueOnce requires an explicit value
            jest.mocked(convertCurrency).mockResolvedValueOnce(undefined);
            await mockBot.processUpdate(createMockMessage(`/changedonation ${donationId} to 8000 USD`, TEST_USERS.accountant));

            expect(guestBalance()).toBe(before + 50);
        });

        test("a donation worth less than a coin still earns the reward once corrected upward", async () => {
            const before = guestBalance();
            const { donationId } = await fundsService.donate(fundName, 99, "AMD", TEST_USERS.guest, TEST_USERS.accountant);

            await mockBot.processUpdate(createMockMessage(`/changedonation ${donationId} to 5000 AMD`, TEST_USERS.accountant));

            expect(guestBalance()).toBe(before + 50);
            expect(hackemcoinsService.getHistory(TEST_USERS.guest.userid).some(entry => entry.amount === 0)).toBe(false);
        });

        test("editing a donation made before hackemcoins existed doesn't reward it retroactively", async () => {
            const before = guestBalance();
            const fund = fundsRepository.getFundByName(fundName)!;
            const donationId = fundsRepository.addDonationTo(
                fund.id,
                TEST_USERS.guest.userid,
                5000,
                TEST_USERS.accountant.userid,
                "AMD"
            );

            await mockBot.processUpdate(createMockMessage(`/changedonation ${donationId} to 9000 AMD`, TEST_USERS.accountant));
            await mockBot.processUpdate(createMockMessage(`/removedonation ${donationId}`, TEST_USERS.accountant));

            expect(mockBot.popResults()).toEqual(["funds\\.changedonation\\.success", "funds\\.removedonation\\.success"]);
            expect(guestBalance()).toBe(before);
        });

        test("a replayed donation event doesn't reward the donation twice", async () => {
            const before = guestBalance();
            const { donationId } = await fundsService.donate(fundName, 5000, "AMD", TEST_USERS.guest, TEST_USERS.accountant);
            const donation = fundsService.getDonationById(donationId)!;

            await broadcast.emitAsync(BroadcastEvents.DonationAdded, { donation, actor: TEST_USERS.accountant });

            expect(guestBalance()).toBe(before + 50);
        });

        test("a failed reward keeps the donation and doesn't block later rewards", async () => {
            const before = guestBalance();

            jest.spyOn(hackemcoinsRepository, "addTransaction").mockImplementationOnce(() => {
                throw new Error("Mocked journal failure");
            });

            const { donationId } = await fundsService.donate(fundName, 5000, "AMD", TEST_USERS.guest, TEST_USERS.accountant);

            expect(fundsService.getDonationById(donationId)).toBeDefined();
            expect(guestBalance()).toBe(before);

            await fundsService.donate(fundName, 3000, "AMD", TEST_USERS.guest, TEST_USERS.accountant);

            expect(guestBalance()).toBe(before + 30);
        });
    });
});
