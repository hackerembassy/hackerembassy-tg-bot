import { Update } from "node-telegram-bot-api";

import { TEST_USERS } from "@data/seed";
import { hackemcoinsService } from "@services/domain/hackemcoins";
import { snacksService } from "@services/domain/snacks";
import { DEFAULT_USER_RATE_LIMIT } from "@hackembot/core/classes/RateLimit";
import { ButtonFlags } from "@hackembot/core/inlineButtons";

import { createMockBot, createMockCallbackQuery, createMockMessage } from "../../mocks/bot";

const guestBalance = () => hackemcoinsService.getBalance(TEST_USERS.guest.userid);
const topUpGuest = (amount: number) => hackemcoinsService.grant(TEST_USERS.guest, TEST_USERS.admin, amount, "test top-up");
const lastPurchaseId = () => hackemcoinsService.getHistory(TEST_USERS.guest.userid, 1)[0].id;
const snackId = (name: string) => snacksService.getSnack(name)!.id;

const buyButton = (id: number, user = TEST_USERS.guest) =>
    createMockCallbackQuery("snackbuy", user, { flags: ButtonFlags.Editing, params: id });
const receipt = "snacks\\.take\\.success\nsnacks\\.take\\.cancelhint";

describe("Bot Snacks commands:", () => {
    const mockBot = createMockBot();

    // Button taps are throttled, so each simulated tap waits out the cooldown
    const press = async (update: Update) => {
        jest.useFakeTimers();
        await mockBot.processUpdate(update);
        jest.advanceTimersByTime(DEFAULT_USER_RATE_LIMIT);
        jest.useRealTimers();
    };
    const buy = (name: string, user = TEST_USERS.guest) => {
        return press(buyButton(snackId(name), user));
    };

    afterEach(() => mockBot.popResults());

    test("snack management commands are restricted to residents", async () => {
        await mockBot.processUpdate(createMockMessage("/addsnack Chips price 10", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/setsnackstock Chips 10", TEST_USERS.tenant));
        await mockBot.processUpdate(createMockMessage("/setsnackprice Chips 10", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/removesnack Chips", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/undosnack 1", TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual(Array.from({ length: 5 }, () => "general\\.errors\\.restricted"));
        expect(snacksService.getSnack("Chips")).toBeUndefined();
    });

    test("/addsnack creates a snack once, case-insensitively, and logs it", async () => {
        await mockBot.processUpdate(createMockMessage("/addsnack Club-Mate price 200 stock 2", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/addsnack club-mate price 100", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/addsnack", TEST_USERS.accountant));

        expect(mockBot.popResults()).toEqual([
            "snacks\\.add\\.success",
            "snacks\\.add\\.log",
            "snacks\\.add\\.exists",
            "snacks\\.add\\.help",
        ]);
        expect(snacksService.getSnack("CLUB-MATE")).toMatchObject({ name: "Club-Mate", price: 200, stock: 2 });
    });

    test("tapping a snack the buyer can't afford shows its price and charges nothing", async () => {
        const balance = guestBalance();

        await buy("Club-Mate");

        expect(mockBot.popResults()).toEqual(["snacks\\.take\\.insufficient"]);
        expect(guestBalance()).toBe(balance);
        expect(snacksService.getSnack("Club-Mate")?.stock).toBe(2);
    });

    test("one tap charges the price, decrements the stock, logs and tells how to cancel", async () => {
        topUpGuest(400);

        await buy("Club-Mate");

        expect(mockBot.popResults()).toEqual([receipt, "snacks\\.take\\.log"]);
        expect(guestBalance()).toBe(200);
        expect(snacksService.getSnack("Club-Mate")?.stock).toBe(1);
        expect(hackemcoinsService.getHistory(TEST_USERS.guest.userid, 1)[0]).toMatchObject({ type: "purchase", amount: -200 });
    });

    test("a snack stops at zero stock and disappears from /snacks for non-residents", async () => {
        topUpGuest(1000);
        const id = snackId("Club-Mate");

        await buy("Club-Mate");
        await press(buyButton(id));
        await mockBot.processUpdate(createMockMessage("/snacks", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/snacks", TEST_USERS.accountant));

        const [success, log, outOfStock, guestList, residentList] = mockBot.popResults();

        expect([success, log, outOfStock, guestList]).toEqual([
            receipt,
            "snacks\\.take\\.log",
            "snacks\\.take\\.outofstock",
            "snacks\\.list\\.empty",
        ]);
        expect(residentList).toContain("`Club\\-Mate` \\- 200 HC, snacks\\.list\\.outofstock");
        expect(snacksService.getSnack("Club-Mate")?.stock).toBe(0);
    });

    test("an unknown snack can't be bought, and typing /snackbuy does nothing", async () => {
        await press(buyButton(999999));
        await mockBot.processUpdate(createMockMessage("/snackbuy", TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual(["snacks\\.take\\.notfound"]);
    });

    test("/undosnack refunds the buyer, restores the stock, logs it and can't be repeated", async () => {
        const balance = guestBalance();
        const purchaseId = lastPurchaseId();

        await mockBot.processUpdate(createMockMessage(`/undosnack ${purchaseId}`, TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage(`/undosnack ${purchaseId}`, TEST_USERS.accountant));

        expect(mockBot.popResults()).toEqual([
            "snacks\\.undo\\.success",
            "snacks\\.undo\\.log",
            "hackemcoins\\.received\\.refund",
            "snacks\\.undo\\.already",
        ]);
        expect(guestBalance()).toBe(balance + 200);
        expect(snacksService.getSnack("Club-Mate")?.stock).toBe(1);
    });

    test("/undosnack only accepts purchase ids", async () => {
        const { transaction: grant } = topUpGuest(1);

        await mockBot.processUpdate(createMockMessage(`/undosnack ${grant.id}`, TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/undosnack 999999", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/undosnack", TEST_USERS.accountant));

        expect(mockBot.popResults()).toEqual(["snacks\\.undo\\.notfound", "snacks\\.undo\\.notfound", "snacks\\.undo\\.help"]);
    });

    test("/setsnackstock and /setsnackprice update an existing snack and log the change", async () => {
        await mockBot.processUpdate(createMockMessage("/setsnackstock club-mate 7", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/setsnackprice Club-Mate 150", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/setsnackstock Unicorn tears 3", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/setsnackprice Club-Mate", TEST_USERS.accountant));

        expect(mockBot.popResults()).toEqual([
            "snacks\\.stock\\.success",
            "snacks\\.stock\\.log",
            "snacks\\.price\\.success",
            "snacks\\.price\\.log",
            "snacks\\.errors\\.notfound",
            "snacks\\.price\\.help",
        ]);
        expect(snacksService.getSnack("Club-Mate")).toMatchObject({ price: 150, stock: 7 });
    });

    test("/removesnack hides the snack, and /addsnack with the same name brings it back", async () => {
        const id = snackId("Club-Mate");

        await mockBot.processUpdate(createMockMessage("/removesnack Club-Mate", TEST_USERS.accountant));
        await press(buyButton(id));
        await mockBot.processUpdate(createMockMessage("/addsnack Club-Mate price 250 stock 3", TEST_USERS.accountant));

        expect(mockBot.popResults()).toEqual([
            "snacks\\.remove\\.success",
            "snacks\\.remove\\.log",
            "snacks\\.take\\.notfound",
            "snacks\\.add\\.success",
            "snacks\\.add\\.log",
        ]);
        expect(snacksService.getSnack("Club-Mate")).toMatchObject({ price: 250, stock: 3 });
    });

    test("a purchase that fails halfway leaves both the balance and the stock untouched", () => {
        topUpGuest(1000);
        const balance = guestBalance();

        jest.spyOn(hackemcoinsService, "chargePurchase").mockImplementationOnce(() => {
            throw new Error("Mocked charge failure");
        });

        expect(() => snacksService.purchase(snackId("Club-Mate"), TEST_USERS.guest)).toThrow("Mocked charge failure");
        expect(snacksService.getSnack("Club-Mate")?.stock).toBe(3);
        expect(guestBalance()).toBe(balance);
    });

    test("a balance equal to the price buys exactly one snack", async () => {
        const balance = guestBalance();

        hackemcoinsService.deduct(TEST_USERS.guest, TEST_USERS.admin, balance - 250, "test reset");

        await buy("Club-Mate");
        await buy("Club-Mate");

        expect(mockBot.popResults()).toEqual([receipt, "snacks\\.take\\.log", "snacks\\.take\\.insufficient"]);
        expect(guestBalance()).toBe(0);
    });

    test("non-ASCII snack names are found case-insensitively and can't be duplicated", async () => {
        await mockBot.processUpdate(createMockMessage("/addsnack Чипсы price 10 stock 5", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/addsnack чипсы price 20", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/setsnackstock ЧИПСЫ 9", TEST_USERS.accountant));

        expect(mockBot.popResults()).toEqual([
            "snacks\\.add\\.success",
            "snacks\\.add\\.log",
            "snacks\\.add\\.exists",
            "snacks\\.stock\\.success",
            "snacks\\.stock\\.log",
        ]);
        expect(snacksService.getSnacks().filter(snack => snack.name.toLowerCase() === "чипсы")).toHaveLength(1);
        expect(snacksService.getSnack("Чипсы")).toMatchObject({ name: "Чипсы", price: 10, stock: 9 });
    });

    test("a free snack purchase shows up in /hchistory", async () => {
        await mockBot.processUpdate(createMockMessage("/addsnack Water price 0 stock 1", TEST_USERS.accountant));
        await buy("Water");
        mockBot.popResults();

        expect(hackemcoinsService.getHistory(TEST_USERS.guest.userid, 1)[0]).toMatchObject({ type: "purchase", amount: 0 });
    });

    test("/cancelsnack lets the buyer take back their own purchase once and logs it for residents", async () => {
        await mockBot.processUpdate(createMockMessage("/addsnack Tea price 5 stock 5", TEST_USERS.accountant));
        topUpGuest(100);
        mockBot.popResults();
        const balance = guestBalance();

        await buy("Tea");
        const purchaseId = lastPurchaseId();
        mockBot.popResults();

        await mockBot.processUpdate(createMockMessage(`/cancelsnack ${purchaseId}`, TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage(`/cancelsnack ${purchaseId}`, TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/cancelsnack", TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual([
            "snacks\\.undo\\.success",
            "snacks\\.cancel\\.log",
            "snacks\\.cancel\\.invalid",
            "snacks\\.cancel\\.help",
        ]);
        expect(guestBalance()).toBe(balance);
        expect(snacksService.getSnack("Tea")?.stock).toBe(5);
    });

    test("/cancelsnack refuses someone else's purchase, other operations and anything older than 2 minutes", async () => {
        await buy("Tea");
        const purchaseId = lastPurchaseId();
        const { transaction: grant } = topUpGuest(1);
        mockBot.popResults();
        const balance = guestBalance();

        await mockBot.processUpdate(createMockMessage(`/cancelsnack ${purchaseId}`, TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage(`/cancelsnack ${grant.id}`, TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/cancelsnack 999999", TEST_USERS.guest));

        const now = Date.now();
        jest.spyOn(Date, "now").mockReturnValue(now + 2 * 60 * 1000 + 1000);
        await mockBot.processUpdate(createMockMessage(`/cancelsnack ${purchaseId}`, TEST_USERS.guest));
        jest.restoreAllMocks();

        expect(mockBot.popResults()).toEqual(Array.from({ length: 4 }, () => "snacks\\.cancel\\.invalid"));
        expect(guestBalance()).toBe(balance);
        expect(snacksService.getSnack("Tea")?.stock).toBe(4);
    });

    test("/snacks shows buy buttons in a private chat and only a link to the bot in groups", async () => {
        const sendMessage = jest.spyOn(mockBot, "sendMessage");
        const groupMessage = createMockMessage("/snacks", TEST_USERS.guest);
        groupMessage.message!.chat = { id: -100, type: "group" };

        await mockBot.processUpdate(createMockMessage("/snacks", TEST_USERS.guest));
        await mockBot.processUpdate(groupMessage);

        const [privateKeyboard, groupKeyboard] = sendMessage.mock.calls.map(
            call => (call[2].reply_markup as { inline_keyboard: { callback_data?: string; url?: string }[][] }).inline_keyboard
        );

        expect(privateKeyboard.flat().every(button => button.callback_data?.includes('"cmd":"snackbuy"'))).toBe(true);
        expect(privateKeyboard.flat().length).toBeGreaterThan(0);
        expect(groupKeyboard).toHaveLength(1);
        expect(groupKeyboard[0][0].url).toContain("?start=snacks");
        jest.restoreAllMocks();
    });

    test("a receipt that can't replace the list is sent as a new message", async () => {
        jest.spyOn(mockBot, "editMessageText").mockRejectedValueOnce(new Error("message to edit not found"));

        await buy("Tea");

        expect(mockBot.popResults()).toEqual([receipt, "snacks\\.take\\.log"]);
        jest.restoreAllMocks();
    });
});
