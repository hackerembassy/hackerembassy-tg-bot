import request from "supertest";

import fundsRepository from "@data/repositories/funds";
import { TEST_USERS } from "@data/seed";

import apiRouter from "@hackemapi/bot/routers/api";
import embassyService from "@services/embassy/embassy";

import { appWith, bearer, HASS_TOKEN, issueApiKey, TERMINAL_TOKEN } from "../helpers";

describe("Bot HTTP API /api router:", () => {
    const app = appWith(apiRouter, "/api");

    test("member-only actions require a token and a member role", async () => {
        const guestToken = issueApiKey(TEST_USERS.guest);
        const memberToken = issueApiKey(TEST_USERS.accountant);

        const noToken = await request(app).post("/api/open").send();
        const guestAttempt = await request(app).post("/api/open").set(bearer(guestToken)).send();
        const memberAttempt = await request(app).post("/api/open").set(bearer(memberToken)).send();

        expect(noToken.status).toBe(401);
        expect(guestAttempt.status).toBe(403);
        expect(memberAttempt.status).toBe(200);

        const status = await request(app).get("/api/status");
        expect((status.body as { open: boolean }).open).toBeTruthy();

        await request(app).post("/api/close").set(bearer(memberToken)).send();
    });

    test("/usernames and /funds are only reachable by the hass/terminal special entities, not regular users", async () => {
        const memberToken = issueApiKey(TEST_USERS.admin);

        const noToken = await request(app).get("/api/usernames");
        const regularUser = await request(app).get("/api/usernames").set(bearer(memberToken));
        const hass = await request(app).get("/api/usernames").set(bearer(HASS_TOKEN));
        const terminal = await request(app).get("/api/funds").set(bearer(TERMINAL_TOKEN));

        expect(noToken.status).toBe(401);
        expect(regularUser.status).toBe(403);
        expect(hass.status).toBe(200);
        expect(terminal.status).toBe(200);
    });

    test("/setgoing, /in, and /out require a trusted-member token", async () => {
        const guestToken = issueApiKey(TEST_USERS.guest);
        const memberToken = issueApiKey(TEST_USERS.accountant);

        const setgoingNoToken = await request(app).post("/api/setgoing").send({ isgoing: true });
        const setgoingGuest = await request(app).post("/api/setgoing").set(bearer(guestToken)).send({ isgoing: true });
        const setgoingBadBody = await request(app).post("/api/setgoing").set(bearer(memberToken)).send({});
        const setgoingSuccess = await request(app).post("/api/setgoing").set(bearer(memberToken)).send({ isgoing: true });

        const inGuest = await request(app).post("/api/in").set(bearer(guestToken)).send();
        const inSuccess = await request(app).post("/api/in").set(bearer(memberToken)).send();

        const outGuest = await request(app).post("/api/out").set(bearer(guestToken)).send();
        const outSuccess = await request(app).post("/api/out").set(bearer(memberToken)).send();

        expect(setgoingNoToken.status).toBe(401);
        expect(setgoingGuest.status).toBe(403);
        expect(setgoingBadBody.status).toBe(400);
        expect(setgoingSuccess.status).toBe(200);
        expect(inGuest.status).toBe(403);
        expect(inSuccess.status).toBe(200);
        expect(outGuest.status).toBe(403);
        expect(outSuccess.status).toBe(200);
    });

    test("/space and /status are readable without authentication", async () => {
        const space = await request(app).get("/api/space");
        const status = await request(app).get("/api/status");

        expect(space.status).toBe(200);
        expect(status.status).toBe(200);
    });

    test("/funds/:id/donations records a real donation for a valid fund and rejects malformed input", async () => {
        const terminalAuth = bearer(TERMINAL_TOKEN);
        fundsRepository.addFund({
            name: "Api_Test_Fund",
            target_value: 100,
            target_currency: "USD",
            status: "open",
        });
        const fundId = fundsRepository.getFundByName("Api_Test_Fund")?.id;

        const missingBody = await request(app).post(`/api/funds/${fundId}/donations`).set(terminalAuth).send({});
        const unknownUser = await request(app)
            .post(`/api/funds/${fundId}/donations`)
            .set(terminalAuth)
            .send({ username: "nobody-such-user", amount: 10 });
        const success = await request(app)
            .post(`/api/funds/${fundId}/donations`)
            .set(terminalAuth)
            .send({ username: TEST_USERS.guest.username, amount: 10, currency: "USD" });

        expect(missingBody.status).toBe(400);
        expect(unknownUser.status).toBe(400);
        expect(success.status).toBe(200);
        expect(fundsRepository.getDonationsForName("Api_Test_Fund")).toHaveLength(1);

        fundsRepository.removeFundByName("Api_Test_Fund");
    });

    test("/climate returns public floors only with a short cache header, 503 when unavailable", async () => {
        const floor = { temperature: "23", humidity: "40" };
        jest.mocked(embassyService.getSpaceClimateCached).mockResolvedValueOnce({
            firstFloor: floor,
            secondFloor: floor,
            bedroom: floor,
        });

        const ok = await request(app).get("/api/climate");
        expect(ok.status).toBe(200);
        expect(ok.body).toEqual({ firstFloor: floor, secondFloor: floor });
        expect(ok.headers["cache-control"]).toBe("public, max-age=5");

        const failed = await request(app).get("/api/climate");
        expect(failed.status).toBe(503);
    });

    test("/printers returns the printers summary with a short cache header", async () => {
        const summary = [{ name: "anette", state: "printing", progress: 68 }];
        jest.mocked(embassyService.getPrintersSummaryCached).mockResolvedValueOnce(summary);

        const response = await request(app).get("/api/printers");

        expect(response.status).toBe(200);
        expect(response.body).toEqual(summary);
        expect(response.headers["cache-control"]).toBe("public, max-age=5");
    });
});
