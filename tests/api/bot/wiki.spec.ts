import { createHmac } from "node:crypto";

import request from "supertest";

import wiki from "@services/external/wiki";
import bot from "@hackembot/instance";

import wikiRouter from "@hackemapi/bot/routers/wiki";

import { appWith, OUTLINE_SIGNING_SECRET } from "../helpers";

function outlineSignature(body: unknown, timestamp = Date.now()) {
    const bodyString = JSON.stringify(body);
    const signature = createHmac("sha256", OUTLINE_SIGNING_SECRET).update(`${timestamp}.${bodyString}`).digest("hex");

    return `t=${timestamp},s=${signature}`;
}

function updateBodyFor(url: string, text: string) {
    return {
        event: "documents.update",
        payload: { model: { title: "Test", url, updatedBy: { name: "Someone" }, text } },
    };
}

describe("Bot HTTP API /api/wiki router:", () => {
    const app = appWith(wikiRouter, "/wiki");

    // The webhook handler schedules a real (debounced, minute-long) setTimeout, and the stale-
    // signature check compares against Date.now() - faking both (but leaving the timer/microtask
    // APIs supertest/express rely on alone) lets tests fast-forward through both deterministically,
    // and beforeEach/afterEach restores real timers even if an assertion throws mid-test.
    beforeEach(() => {
        jest.useFakeTimers({
            doNotFake: [
                "hrtime",
                "nextTick",
                "performance",
                "queueMicrotask",
                "requestAnimationFrame",
                "cancelAnimationFrame",
                "requestIdleCallback",
                "cancelIdleCallback",
                "setImmediate",
                "clearImmediate",
                "setInterval",
                "clearInterval",
            ],
        });
    });
    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    test("/tree lists the wiki page tree", async () => {
        (wiki.listPagesAsTree as jest.Mock).mockResolvedValueOnce([{ id: 1, children: [] }]);

        const response = await request(app).get("/wiki/tree");

        expect(response.status).toBe(200);
        expect(response.body).toEqual([{ id: 1, children: [] }]);
    });

    test("/page/:id returns page content, 404 when missing", async () => {
        (wiki.getPageContent as jest.Mock).mockResolvedValueOnce("hello wiki");
        const found = await request(app).get("/wiki/page/getting-started");

        (wiki.getPageContent as jest.Mock).mockImplementationOnce(async () => {});
        const notFound = await request(app).get("/wiki/page/nonexistent");

        expect(found.status).toBe(200);
        expect(found.body).toEqual({ id: "getting-started", content: "hello wiki" });
        expect(notFound.status).toBe(404);
    });

    test("/attachment/:id requires a signature and redirects to the resolved location", async () => {
        const missingSignature = await request(app).get("/wiki/attachment/file-1");

        (wiki.resolveAttachmentUrl as jest.Mock).mockResolvedValueOnce("https://wiki.test/files/file-1");
        const withSignature = await request(app).get("/wiki/attachment/file-1?sig=abc");

        expect(missingSignature.status).toBe(400);
        expect(withSignature.status).toBe(302);
        expect(withSignature.headers.location).toBe("https://wiki.test/files/file-1");
    });

    test("the Outline webhook rejects requests without a valid or fresh signature", async () => {
        const body = updateBodyFor("/doc/test", "hello");

        const noSignature = await request(app).post("/wiki/hooks/documents.update").send(body);
        const badSignature = await request(app)
            .post("/wiki/hooks/documents.update")
            .set("outline-signature", `t=${Date.now()},s=deadbeef`)
            .send(body);

        // A signature that was valid a minute ago must be rejected - otherwise a captured
        // signature+body could be replayed indefinitely.
        const staleTimestamp = outlineSignature(body);
        jest.advanceTimersByTime(61_000);
        const staleSignature = await request(app)
            .post("/wiki/hooks/documents.update")
            .set("outline-signature", staleTimestamp)
            .send(body);

        const validSignature = await request(app)
            .post("/wiki/hooks/documents.update")
            .set("outline-signature", outlineSignature(body))
            .send(body);
        // The valid request above scheduled the debounced alert timer; flush it instead of
        // leaving it dangling.
        jest.runAllTimers();

        expect(noSignature.status).toBe(401);
        expect(badSignature.status).toBe(403);
        expect(staleSignature.status).toBe(401);
        expect(validSignature.status).toBe(200);
    });

    test("the Outline webhook ignores content-less updates (e.g. a document just opened/closed)", async () => {
        const firstEdit = await request(app)
            .post("/wiki/hooks/documents.update")
            .set("outline-signature", outlineSignature(updateBodyFor("/doc/no-op-test", "hello")))
            .send(updateBodyFor("/doc/no-op-test", "hello"));
        // Outline re-fires documents.update with unchanged text when the doc is merely opened/closed
        const reopenedWithNoEdit = await request(app)
            .post("/wiki/hooks/documents.update")
            .set("outline-signature", outlineSignature(updateBodyFor("/doc/no-op-test", "hello")))
            .send(updateBodyFor("/doc/no-op-test", "hello"));
        jest.runAllTimers();

        expect(firstEdit.status).toBe(200);
        expect(reopenedWithNoEdit.status).toBe(200);
        // Only the first, content-changing update should have scheduled an alert
        expect(bot.sendAlert).toHaveBeenCalledTimes(1);
    });
});
