import { IGNORE_UPDATE_TIMEOUT } from "@hackembot/core/constants";

import fundsRepository from "@repositories/funds";
import { TEST_USERS } from "@data/seed";

import { createMockBot, createMockMessage } from "../mocks/bot";

describe("Bot behavior shared for all commands:", () => {
    const mockBot = createMockBot();
    const mockDate = new Date("2023-01-01");

    afterEach(() => fundsRepository.clearFunds());

    test("old messages should be ignored", async () => {
        await mockBot.processUpdate(createMockMessage("/status", TEST_USERS.guest, mockDate.getTime() - 10000));

        await jest.advanceTimersByTimeAsync(IGNORE_UPDATE_TIMEOUT);

        expect(mockBot.popResults()).toHaveLength(0);
    });

    test("bot should respond to messages when it is mentioned", async () => {
        await mockBot.processUpdate(createMockMessage(`/status@${mockBot.name}`));
        await mockBot.processUpdate(createMockMessage(`/status@${mockBot.name} short`));

        expect(mockBot.popResults()).toHaveLength(2);
    });

    test("bot should respond to messages the same way if it was mentioned explicitly", async () => {
        await mockBot.processUpdate(createMockMessage(`/issue@${mockBot.name}`));
        await mockBot.processUpdate(createMockMessage(`/issue`));

        const responses = mockBot.popResults();

        expect(responses[0]).toEqual(responses[1]);
    });

    test("bot should respond to commands with any case and not miss parameters", async () => {
        await mockBot.processUpdate(createMockMessage(`/StAtUs`));
        await mockBot.processUpdate(createMockMessage(`/status`));
        await mockBot.processUpdate(createMockMessage(`/inForce ${TEST_USERS.guest.username}`, TEST_USERS.admin));

        expect(mockBot.popResults()).toHaveLength(3);
    });

    test("bot should respond to commands as impersonated user only when requested by admin", async () => {
        await mockBot.processUpdate(createMockMessage(`/in ~~${TEST_USERS.accountant.username}`, TEST_USERS.admin));
        await mockBot.processUpdate(createMockMessage(`/in ~~${TEST_USERS.accountant.username}`, TEST_USERS.guest));

        expect(mockBot.popResults()).toEqual(["status\\.in\\.gotin\n\nstatus\\.in\\.tryautoinside", "status\\.in\\.notready"]);
    });

    test("bot should not respond to messages when another bot is mentioned", async () => {
        await mockBot.processUpdate(createMockMessage(`/status@${mockBot.name}1`));
        await mockBot.processUpdate(createMockMessage(`/status@${mockBot.name}1 short`));

        expect(mockBot.popResults()).toHaveLength(0);
    });

    test("bot should not respond to messages without a forward slash in the beginning", async () => {
        await mockBot.processUpdate(createMockMessage(`+status`));
        await mockBot.processUpdate(createMockMessage(`status`));
        await mockBot.processUpdate(createMockMessage(` status`));
        await mockBot.processUpdate(createMockMessage(`abc /status`));
        await mockBot.processUpdate(createMockMessage(`+status short`));

        expect(mockBot.popResults()).toHaveLength(0);
    });

    test("commands with the silent modifier should produce no output", async () => {
        await mockBot.processUpdate(createMockMessage("/status -silent"));

        expect(mockBot.popResults()).toHaveLength(0);
    });

    test("guest user should not be allowed to use protected commands", async () => {
        const protectedCommands = [
            "/unlock",
            "/doorbell",
            "/downstairs",
            "/upstairs",
            "/addtopic test_topic test_description",
            "/removetopic test_topic",
            "/outdoors",
            "/superstatus",
            "/open",
            "/close",
            "/setemoji",
            "/inforce telegram_username",
            "/outforce telegram_username",
            "/evict",
            "/residentsdonated",
            "/getuser",
            "/removeuser telegram_username",
            "/updateroles of telegram_username to user_role1|user_role2|user_role3",
            "/sendwishes",
            "/getlogs",
            "/addfund Fund_Name with target 500 USD",
            "/updatefund Fund_Name with target 500 USD as Fund_Name",
            "/changefundstatus of Fund_Name to pending",
            "/adddonation 5 USD from telegram_username to Fund_Name",
            "/changedonation 1 to 55 USD",
            "/removedonation 1",
            "/transferdonation 1 to username",
            "/closefund Fund_Name",
            "/removefund Fund_Name",
            "/setflag flag_name true",
            "/getflags",
        ];

        for (const command of protectedCommands) {
            await mockBot.processUpdate(createMockMessage(command));
        }

        await jest.runAllTimersAsync();
        const expectedForbiddenResponses = Array(protectedCommands.length).fill("general\\.errors\\.restricted");

        expect(mockBot.popResults()).toEqual(expectedForbiddenResponses);
    });
});
