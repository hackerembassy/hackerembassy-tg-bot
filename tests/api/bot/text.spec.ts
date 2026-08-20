import request from "supertest";

import textRouter from "@hackemapi/bot/routers/text";

import { appWith } from "../helpers";

// This router just renders bot command output as plain text for the space website - no auth,
// no mutation, so the useful thing to check is that every listed command actually responds.
describe("Bot HTTP API /text router:", () => {
    const app = appWith(textRouter, "/text");

    test("lists the available text commands", async () => {
        const response = await request(app).get("/text");

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect((response.body as { command: string }[]).map(c => c.command)).toEqual(
            expect.arrayContaining(["status", "join", "donate", "funds", "sponsors"])
        );
    });

    test.each(["join", "events", "funds", "donate", "status"])("/text/%s responds with rendered text", async command => {
        const response = await request(app).get(`/text/${command}`);

        expect(response.status).toBe(200);
        expect(response.text.length).toBeGreaterThan(0);
    });

    test("/text/sponsors responds (empty when there are no sponsors)", async () => {
        const response = await request(app).get("/text/sponsors");

        expect(response.status).toBe(200);
    });
});
