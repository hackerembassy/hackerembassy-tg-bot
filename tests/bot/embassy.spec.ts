import { TEST_USERS } from "@data/seed";

import embassyService from "@services/embassy/embassy";

import { createMockBot, createMockMessage } from "../mocks/bot";

describe("Bot Embassy commands:", () => {
    const mockBot = createMockBot();

    afterEach(() => jest.clearAllMocks());

    test("/unlock is restricted to members and requires the user's device to be detected inside", async () => {
        // Guests can't even attempt it.
        await mockBot.processUpdate(createMockMessage("/unlock", TEST_USERS.guest));

        // A member is still refused if their device isn't seen on the space network - this is the
        // guard that stops a member from unlocking the door remotely while away from the space.
        (embassyService.isAnyDeviceInside as jest.Mock).mockResolvedValueOnce(false);
        await mockBot.processUpdate(createMockMessage("/unlock", TEST_USERS.accountant));

        // Only once their device is detected inside does the door actually unlock.
        (embassyService.isAnyDeviceInside as jest.Mock).mockResolvedValueOnce(true);
        await mockBot.processUpdate(createMockMessage("/unlock", TEST_USERS.accountant));

        expect(mockBot.popResults()).toEqual([
            "general\\.errors\\.restricted",
            "embassy\\.unlock\\.nomac",
            "embassy\\.unlock\\.success",
        ]);
        expect(embassyService.unlockDoorFor).toHaveBeenCalledTimes(1);
    });

    test("camera and doorbell commands are restricted to members", async () => {
        await mockBot.processUpdate(createMockMessage("/allcams", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/webcam", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/doorbell", TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual([
            "general\\.errors\\.restricted",
            "general\\.errors\\.restricted",
            "general\\.errors\\.restricted",
        ]);
        expect(embassyService.getAllCameras).not.toHaveBeenCalled();
        expect(embassyService.getWebcamImage).not.toHaveBeenCalled();
        expect(embassyService.doorbell).not.toHaveBeenCalled();
    });

    test("/gaming down (device shutdown) is restricted to members", async () => {
        await mockBot.processUpdate(createMockMessage("/gaming down", TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual(["general\\.errors\\.restricted"]);
        expect(embassyService.shutdownDevice).not.toHaveBeenCalled();
    });

    test("/text sets the LED matrix text or shows help", async () => {
        await mockBot.processUpdate(createMockMessage("/text", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/text Hello space", TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual(["embassy\\.text\\.help", "embassy\\.text\\.success"]);
    });

    test("/play is restricted to trusted members", async () => {
        await mockBot.processUpdate(createMockMessage("/play some-sound", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/play some-sound", TEST_USERS.accountant));

        expect(mockBot.popResults()).toEqual(["general\\.errors\\.restricted", "embassy\\.play\\.success"]);
    });

    test("/say announces a message in space or shows help", async () => {
        await mockBot.processUpdate(createMockMessage("/say", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/say Hello space", TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual(["embassy\\.say\\.help", "embassy\\.say\\.success"]);
    });

    test("/stop is restricted to trusted members", async () => {
        await mockBot.processUpdate(createMockMessage("/stop", TEST_USERS.guest));
        await mockBot.processUpdate(createMockMessage("/stop", TEST_USERS.accountant));

        expect(mockBot.popResults()).toEqual(["general\\.errors\\.restricted", "embassy\\.stop\\.success"]);
    });
});
