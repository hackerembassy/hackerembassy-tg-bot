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

const pickButton = (id: number, user = TEST_USERS.guest) =>
    createMockCallbackQuery("snack", user, { flags: ButtonFlags.Editing, params: id });
const takeButton = (id: number, price: number, user = TEST_USERS.guest, buyer = user) =>
    createMockCallbackQuery("snackbuy", user, { flags: ButtonFlags.Editing, params: [id, price, buyer.userid] });

describe("Bot Snacks commands:", () => {
    const mockBot = createMockBot();

    // Button taps are throttled per user, so each simulated tap waits out the cooldown
    const press = async (update: Update) => {
        jest.useFakeTimers();
        await mockBot.processUpdate(update);
        jest.advanceTimersByTime(DEFAULT_USER_RATE_LIMIT);
        jest.useRealTimers();
    };
    const buy = async (name: string, user = TEST_USERS.guest) => {
        const snack = snacksService.getSnack(name)!;

        await press(pickButton(snack.id, user));
        await press(takeButton(snack.id, snack.price, user));
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

    test("picking a snack the buyer can't afford shows its price instead of a take button", async () => {
        const balance = guestBalance();

        await press(pickButton(snackId("Club-Mate")));

        expect(mockBot.popResults()).toEqual(["snacks\\.take\\.insufficient"]);
        expect(guestBalance()).toBe(balance);
        expect(snacksService.getSnack("Club-Mate")?.stock).toBe(2);
    });

    test("picking a snack only asks for confirmation; taking it charges, decrements the stock and logs", async () => {
        topUpGuest(400);

        await press(pickButton(snackId("Club-Mate")));

        expect(mockBot.popResults()).toEqual(["snacks\\.take\\.confirm"]);
        expect(guestBalance()).toBe(400);

        await press(takeButton(snackId("Club-Mate"), 200));

        expect(mockBot.popResults()).toEqual(["snacks\\.take\\.success", "snacks\\.take\\.log"]);
        expect(guestBalance()).toBe(200);
        expect(snacksService.getSnack("Club-Mate")?.stock).toBe(1);
        expect(hackemcoinsService.getHistory(TEST_USERS.guest.userid, 1)[0]).toMatchObject({ type: "purchase", amount: -200 });
    });

    test("a snack stops at zero stock and disappears from /snacks for non-residents", async () => {
        topUpGuest(1000);

        await buy("Club-Mate");
        await press(pickButton(snackId("Club-Mate")));
        await mockBot.processUpdate(createMockMessage("/snacks", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/snacks", TEST_USERS.accountant));

        const [confirm, success, log, outOfStock, guestList, residentList] = mockBot.popResults();

        expect([confirm, success, log, outOfStock, guestList]).toEqual([
            "snacks\\.take\\.confirm",
            "snacks\\.take\\.success",
            "snacks\\.take\\.log",
            "snacks\\.take\\.outofstock",
            "snacks\\.list\\.empty",
        ]);
        expect(residentList).toContain("`Club\\-Mate` \\- 200 HC, snacks\\.list\\.outofstock");
        expect(snacksService.getSnack("Club-Mate")?.stock).toBe(0);
    });

    test("an unknown snack can't be picked or taken, and /snack without a button shows the list", async () => {
        await press(pickButton(999999));
        await press(takeButton(999999, 1));
        await mockBot.processUpdate(createMockMessage("/snack", TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual(["snacks\\.take\\.notfound", "snacks\\.take\\.notfound", "snacks\\.list\\.empty"]);
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
        await press(pickButton(id));
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

        expect(() => snacksService.purchase(snackId("Club-Mate"), 250, TEST_USERS.guest)).toThrow("Mocked charge failure");
        expect(snacksService.getSnack("Club-Mate")?.stock).toBe(3);
        expect(guestBalance()).toBe(balance);
    });

    test("a balance equal to the price buys exactly one snack", async () => {
        const balance = guestBalance();

        hackemcoinsService.deduct(TEST_USERS.guest, TEST_USERS.admin, balance - 250, "test reset");

        await buy("Club-Mate");
        await press(pickButton(snackId("Club-Mate")));

        expect(mockBot.popResults()).toEqual([
            "snacks\\.take\\.confirm",
            "snacks\\.take\\.success",
            "snacks\\.take\\.log",
            "snacks\\.take\\.insufficient",
        ]);
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

    test("the take button works once and only for the user who picked the snack", async () => {
        await mockBot.processUpdate(createMockMessage("/addsnack Tea price 5 stock 5", TEST_USERS.accountant));
        topUpGuest(100);
        mockBot.popResults();
        const balance = guestBalance();
        const id = snackId("Tea");

        await press(pickButton(id));
        await press(takeButton(id, 5, TEST_USERS.accountant, TEST_USERS.guest));
        await press(takeButton(id, 5));
        await press(takeButton(id, 5));

        expect(mockBot.popResults()).toEqual(["snacks\\.take\\.confirm", "snacks\\.take\\.success", "snacks\\.take\\.log"]);
        expect(guestBalance()).toBe(balance - 5);
        expect(snacksService.getSnack("Tea")?.stock).toBe(4);
    });

    test("a price changed between picking and taking is not charged", async () => {
        const balance = guestBalance();
        const id = snackId("Tea");

        await press(pickButton(id));
        await mockBot.processUpdate(createMockMessage("/setsnackprice Tea 50", TEST_USERS.accountant));
        await press(takeButton(id, 5));

        expect(mockBot.popResults()).toEqual([
            "snacks\\.take\\.confirm",
            "snacks\\.price\\.success",
            "snacks\\.price\\.log",
            "snacks\\.take\\.pricechanged",
        ]);
        expect(guestBalance()).toBe(balance);
        expect(snacksService.getSnack("Tea")?.stock).toBe(4);
    });
});
