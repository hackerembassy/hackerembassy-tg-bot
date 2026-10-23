import { ChatId } from "node-telegram-bot-api";

import db from "@data/db";
import { doorAccessGrants } from "@data/schema";
import usersRepository from "@data/repositories/users";
import { TEST_USERS } from "@data/seed";
import embassyService from "@services/embassy/embassy";
import { userService } from "@services/domain/user";

import { createMockBot, createMockCallbackQuery, createMockMessage } from "../../mocks/bot";

const NOW = new Date(2026, 6, 14, 12, 0);
const at = (day: number, hours: number, minutes = 0) => new Date(2026, 6, day, hours, minutes);

describe("Door access grants:", () => {
    const mockBot = createMockBot();

    beforeEach(() => {
        jest.setSystemTime(NOW);
        mockBot.popResults();
    });

    afterEach(() => {
        db.delete(doorAccessGrants).run();
        jest.restoreAllMocks();
        (embassyService.isAnyDeviceInside as jest.Mock).mockReset().mockResolvedValue(false);
        (embassyService.unlockDoorFor as jest.Mock).mockClear();
    });

    const grant = (args: string, from: (typeof TEST_USERS)[keyof typeof TEST_USERS] = TEST_USERS.accountant) =>
        mockBot.processUpdate(createMockMessage(`/grantaccess guest ${args}`, from));

    const unlockAsGuestAt = async (date: Date, deviceInside = true) => {
        jest.setSystemTime(date);
        (embassyService.isAnyDeviceInside as jest.Mock).mockResolvedValueOnce(deviceInside);
        await mockBot.processUpdate(createMockMessage("/unlock", TEST_USERS.guest));
    };

    test("a member grants a guest a window, the guest is notified and it is logged", async () => {
        await grant("from 14-07-2026 14:59 to 14-07-2026 17:59");

        expect(mockBot.popResults()).toEqual(["access\\.grant\\.success", "access\\.grant\\.log", "access\\.received\\.grant"]);

        const [stored] = db.select().from(doorAccessGrants).all();

        expect(stored).toMatchObject({
            user_id: TEST_USERS.guest.userid,
            granted_by: TEST_USERS.accountant.userid,
            starts_at: at(14, 14, 59),
            ends_at: at(14, 17, 59),
            revoked_at: null,
        });
    });

    test("the guest can unlock only inside the window", async () => {
        await grant("from 14-07-2026 14:59 to 14-07-2026 17:59");
        mockBot.popResults();

        await unlockAsGuestAt(at(14, 14, 58));
        await unlockAsGuestAt(at(14, 14, 59));
        await unlockAsGuestAt(at(14, 17, 58));
        await unlockAsGuestAt(at(14, 17, 59));

        expect(mockBot.popResults()).toEqual([
            "general\\.errors\\.restricted",
            "embassy\\.unlock\\.success",
            "embassy\\.unlock\\.success",
            "general\\.errors\\.restricted",
        ]);
        expect(embassyService.unlockDoorFor).toHaveBeenCalledTimes(2);
    });

    test("the guest still needs a device detected on the space network", async () => {
        await grant("for 3h");
        mockBot.popResults();

        await unlockAsGuestAt(at(14, 13), false);

        expect(mockBot.popResults()).toEqual(["embassy\\.unlock\\.nomac"]);
        expect(embassyService.unlockDoorFor).not.toHaveBeenCalled();
    });

    test("the unlock button in the notification works for the guest inside the window", async () => {
        await grant("for 1h");
        mockBot.popResults();

        (embassyService.isAnyDeviceInside as jest.Mock).mockResolvedValueOnce(true);
        await mockBot.processUpdate(createMockCallbackQuery("unlock", TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual(["embassy\\.unlock\\.success"]);
        expect(embassyService.unlockDoorFor).toHaveBeenCalledTimes(1);
    });

    test("shorthands: time only means today, a time-only end before the start rolls over midnight, for <duration> starts now", async () => {
        await grant("from 14:59 to 17:59");
        await grant("from 22:00 to 02:00");
        await grant("for 2h30m");
        await grant("from 15-07-2026 10:00 for 1d");

        const windows = db
            .select()
            .from(doorAccessGrants)
            .all()
            .map(({ starts_at, ends_at }) => [starts_at, ends_at]);

        expect(windows).toEqual([
            [at(14, 14, 59), at(14, 17, 59)],
            [at(14, 22), at(15, 2)],
            [NOW, at(14, 14, 30)],
            [at(15, 10), at(16, 10)],
        ]);
    });

    test("several windows can coexist and either one opens the door", async () => {
        await grant("from 14-07-2026 14:00 to 14-07-2026 15:00");
        await grant("from 16-07-2026 18:00 to 16-07-2026 20:00");
        mockBot.popResults();

        await unlockAsGuestAt(at(14, 14, 30));
        await unlockAsGuestAt(at(15, 12));
        await unlockAsGuestAt(at(16, 19));

        expect(mockBot.popResults()).toEqual([
            "embassy\\.unlock\\.success",
            "general\\.errors\\.restricted",
            "embassy\\.unlock\\.success",
        ]);
    });

    test.each([
        ["end before start", "from 14-07-2026 18:00 to 14-07-2026 17:00", "access\\.errors\\.order"],
        ["window already over", "from 13-07-2026 10:00 to 13-07-2026 12:00", "access\\.errors\\.expired"],
        ["longer than 3 days", "from 15-07-2026 10:00 to 18-07-2026 10:01", "access\\.errors\\.toolong"],
        ["starting more than a week ahead", "from 21-07-2026 12:01 for 1h", "access\\.errors\\.toofar"],
        ["unparseable dates", "from 31-02-2026 10:00 to 31-02-2026 12:00", "access\\.grant\\.help"],
        ["missing end", "from 14-07-2026 14:00", "access\\.grant\\.help"],
    ])("rejects %s", async (_, args, expected) => {
        await grant(args);

        expect(mockBot.popResults()).toEqual([expected]);
        expect(db.select().from(doorAccessGrants).all()).toHaveLength(0);
    });

    test("accepts the exact limits: 3 days long, starting exactly a week ahead", async () => {
        await grant("from 21-07-2026 12:00 to 24-07-2026 12:00");

        expect(mockBot.popResults()[0]).toBe("access\\.grant\\.success");
    });

    test("only members can grant and revoke", async () => {
        await grant("for 1h", TEST_USERS.guest);
        await grant("for 1h", TEST_USERS.tenant);
        await mockBot.processUpdate(createMockMessage("/revokeaccess guest", TEST_USERS.tenant));

        expect(mockBot.popResults()).toEqual([
            "general\\.errors\\.restricted",
            "general\\.errors\\.restricted",
            "general\\.errors\\.restricted",
        ]);
        expect(db.select().from(doorAccessGrants).all()).toHaveLength(0);
    });

    test("refuses unknown users and users who can already unlock", async () => {
        await mockBot.processUpdate(createMockMessage("/grantaccess nobody_here for 1h", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/grantaccess tenant for 1h", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/grantaccess admin for 1h", TEST_USERS.accountant));

        expect(mockBot.popResults()).toEqual([
            "general\\.errors\\.nouser",
            "access\\.errors\\.unlocker",
            "access\\.errors\\.unlocker",
        ]);
    });

    test("refuses banned users", async () => {
        usersRepository.addUser(99, "banned_guest", ["banned"]);

        await mockBot.processUpdate(createMockMessage("/grantaccess banned_guest for 1h", TEST_USERS.accountant));

        expect(mockBot.popResults()).toEqual(["access\\.errors\\.banned"]);
        userService.removeUser(99);
    });

    test("tells the granter when the guest can't be messaged", async () => {
        const sendMessage = mockBot.sendMessage.bind(mockBot);

        jest.spyOn(mockBot, "sendMessage").mockImplementation((chatId: ChatId, text, options) =>
            chatId === TEST_USERS.guest.userid
                ? Promise.reject(new Error("ETELEGRAM: 403 Forbidden"))
                : sendMessage(chatId, text, options)
        );

        await grant("for 1h");

        expect(mockBot.popResults()).toEqual(["access\\.grant\\.success", "access\\.grant\\.log", "access\\.grant\\.nodm"]);
        expect(db.select().from(doorAccessGrants).all()).toHaveLength(1);
    });

    test("revoking ends current and upcoming windows, keeps expired ones untouched, and is logged", async () => {
        await grant("from 14-07-2026 12:00 to 14-07-2026 13:00");
        await grant("from 14-07-2026 13:30 to 14-07-2026 15:00");
        await grant("from 16-07-2026 10:00 to 16-07-2026 12:00");

        jest.setSystemTime(at(14, 14));
        mockBot.popResults();

        await mockBot.processUpdate(createMockMessage("/revokeaccess guest", TEST_USERS.admin));

        expect(mockBot.popResults()).toEqual([
            "access\\.revoke\\.success",
            "access\\.revoke\\.log",
            "access\\.received\\.revoke",
        ]);

        const revokedFlags = db
            .select()
            .from(doorAccessGrants)
            .all()
            .map(row => row.revoked_by);

        expect(revokedFlags).toEqual([null, TEST_USERS.admin.userid, TEST_USERS.admin.userid]);

        await unlockAsGuestAt(at(14, 14, 30));
        await unlockAsGuestAt(at(16, 11));
        await mockBot.processUpdate(createMockMessage("/revokeaccess guest", TEST_USERS.admin));

        expect(mockBot.popResults()).toEqual([
            "general\\.errors\\.restricted",
            "general\\.errors\\.restricted",
            "access\\.revoke\\.none",
        ]);
    });

    test("without arguments both commands show help", async () => {
        await mockBot.processUpdate(createMockMessage("/grantaccess", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/grantaccess guest", TEST_USERS.accountant));
        await mockBot.processUpdate(createMockMessage("/revokeaccess", TEST_USERS.accountant));

        expect(mockBot.popResults()).toEqual(["access\\.grant\\.help", "access\\.grant\\.help", "access\\.revoke\\.help"]);
    });
});
