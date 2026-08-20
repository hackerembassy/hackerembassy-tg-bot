import express from "express";
import request from "supertest";

import embassyService from "@services/embassy/embassy";

import embassyRouter from "@hackemapi/bot/routers/embassy";
import { authentificate } from "@hackemapi/bot/middleware";
import { TEST_USERS } from "@data/seed";

import { bearer, issueApiKey } from "../helpers";

// This is the thin proxy the bot's public API exposes for LED-matrix/TTS actions - not the
// internal embassy service's own API (see src/api/embassy). In the real app, authentification
// happens once at the parent /api router before /embassy is mounted, so it's replicated here.
describe("Bot HTTP API /api/embassy router:", () => {
    const app = express();
    app.use(express.json());
    app.use(authentificate);
    app.use("/embassy", embassyRouter);

    afterEach(() => jest.clearAllMocks());

    test("/text requires a member token and forwards the message to the LED matrix", async () => {
        const memberToken = issueApiKey(TEST_USERS.accountant);
        const guestToken = issueApiKey(TEST_USERS.guest);

        const noToken = await request(app).post("/embassy/text").send({ text: "hi" });
        const guestAttempt = await request(app).post("/embassy/text").set(bearer(guestToken)).send({ text: "hi" });
        const missingText = await request(app).post("/embassy/text").set(bearer(memberToken)).send({});

        // ledMatrix() is chained with .then()/.catch() rather than awaited, so it needs an actual
        // resolved promise (a bare jest.fn() returns undefined, and undefined.then() throws).
        (embassyService.ledMatrix as jest.Mock).mockImplementationOnce(async () => {});
        const success = await request(app).post("/embassy/text").set(bearer(memberToken)).send({ text: "hi" });

        expect(noToken.status).toBe(401);
        expect(guestAttempt.status).toBe(403);
        expect(missingText.status).toBe(400);
        expect(success.status).toBe(200);
        expect(embassyService.ledMatrix).toHaveBeenCalledWith("hi");
    });

    test("/say requires a member token and forwards the message to TTS", async () => {
        const memberToken = issueApiKey(TEST_USERS.accountant);
        const guestToken = issueApiKey(TEST_USERS.guest);

        const guestAttempt = await request(app).post("/embassy/say").set(bearer(guestToken)).send({ text: "hi" });

        (embassyService.tts as jest.Mock).mockImplementationOnce(async () => {});
        const success = await request(app).post("/embassy/say").set(bearer(memberToken)).send({ text: "hi" });

        expect(guestAttempt.status).toBe(403);
        expect(success.status).toBe(200);
        expect(embassyService.tts).toHaveBeenCalledWith("hi");
    });
});
