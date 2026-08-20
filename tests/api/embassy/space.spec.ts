import request from "supertest";

import { alarm, displays } from "@services/embassy/hass";
import DoorLock, { UnlockMethod } from "@services/embassy/door";
import { decrypt } from "@utils/security";

import spaceRouter from "@hackemapi/embassy/routers/space";

import { appWith } from "../helpers";

// The real DoorLock/alarm/displays talk to MQTT/HTTP hardware; decrypt does real RSA against
// files under config/sec that don't exist outside a provisioned dev box (see scripts/initDev.ts).
jest.mock("@services/embassy/door", () => ({
    __esModule: true,
    default: { unlock: jest.fn() },
    UnlockMethod: { MQTT: "MQTT", HTTP: "HTTP" },
}));
jest.mock("@services/embassy/hass", () => ({
    __esModule: true,
    alarm: { disarm: jest.fn() },
    displays: { showOnMatrix: jest.fn() },
}));
jest.mock("@utils/security", () => ({ __esModule: true, decrypt: jest.fn() }));

describe("Embassy HTTP API /space router:", () => {
    const app = appWith(spaceRouter, "/space");

    const originalUnlockKey = process.env["UNLOCKKEY"];
    beforeAll(() => {
        process.env["UNLOCKKEY"] = "the-real-unlock-key";
    });
    afterAll(() => {
        process.env["UNLOCKKEY"] = originalUnlockKey;
    });
    afterEach(() => jest.clearAllMocks());

    test("/unlock requires a token that decrypts to the configured unlock key", async () => {
        const noAuth = await request(app).post("/space/unlock").send({});

        (decrypt as jest.Mock).mockResolvedValueOnce("wrong-key");
        const wrongKey = await request(app).post("/space/unlock").set("Authorization", "Bearer garbage").send({});

        (decrypt as jest.Mock).mockResolvedValueOnce("the-real-unlock-key");
        (DoorLock.unlock as jest.Mock).mockResolvedValueOnce(true);
        const correctKey = await request(app).post("/space/unlock").set("Authorization", "Bearer valid-token").send({});

        expect(noAuth.status).toBe(401);
        expect(wrongKey.status).toBe(403);
        expect(correctKey.status).toBe(200);
        expect(DoorLock.unlock).toHaveBeenCalledWith(UnlockMethod.MQTT);
    });

    test("/alarm only disarms with a valid token and a 'disarm' state", async () => {
        (decrypt as jest.Mock).mockResolvedValue("the-real-unlock-key");

        const noAuth = await request(app).post("/space/alarm").send({ state: "disarm" });
        const badState = await request(app)
            .post("/space/alarm")
            .set("Authorization", "Bearer valid-token")
            .send({ state: "arm" });
        const success = await request(app)
            .post("/space/alarm")
            .set("Authorization", "Bearer valid-token")
            .send({ state: "disarm" });

        expect(noAuth.status).toBe(401);
        expect(badState.status).toBe(400);
        expect(success.status).toBe(200);
        expect(alarm.disarm).toHaveBeenCalledTimes(1);
    });

    test("/led-matrix requires a message but has no authentication of its own", async () => {
        const missingMessage = await request(app).post("/space/led-matrix").send({});

        (displays.showOnMatrix as jest.Mock).mockImplementationOnce(async () => {});
        const success = await request(app).post("/space/led-matrix").send({ message: "hi" });

        expect(missingMessage.status).toBe(400);
        expect(success.status).toBe(200);
        expect(displays.showOnMatrix).toHaveBeenCalledWith("hi");
    });
});
