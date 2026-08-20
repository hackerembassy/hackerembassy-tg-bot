import { createHmac } from "node:crypto";

import request from "supertest";

import wiki from "@services/external/wiki";

import wikiRouter from "@hackemapi/bot/routers/wiki";

import { appWith } from "../helpers";

function outlineSignature(body: unknown) {
    const timestamp = Date.now();
    const bodyString = JSON.stringify(body);
    const signature = createHmac("sha256", "test-outline-signing-secret").update(`${timestamp}.${bodyString}`).digest("hex");

    return `t=${timestamp},s=${signature}`;
}

describe("Bot HTTP API /api/wiki router:", () => {
    const app = appWith(wikiRouter, "/wiki");

    afterEach(() => jest.clearAllMocks());

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

    test("the Outline webhook rejects requests without a valid signature", async () => {
        const body = {
            event: "documents.update",
            payload: { model: { title: "Test", url: "/doc/test", updatedBy: { name: "Someone" } } },
        };

        const noSignature = await request(app).post("/wiki/hooks/documents.update").send(body);
        const badSignature = await request(app)
            .post("/wiki/hooks/documents.update")
            .set("outline-signature", `t=${Date.now()},s=deadbeef`)
            .send(body);

        // A valid signature schedules a real (debounced, minute-long) setTimeout before responding.
        // Make it fire immediately instead of leaving a dangling timer that keeps the process alive.
        const setTimeoutSpy = jest.spyOn(globalThis, "setTimeout").mockImplementation(((fn: () => void) => {
            fn();
            return 0 as unknown as NodeJS.Timeout;
        }) as typeof setTimeout);

        const validSignature = await request(app)
            .post("/wiki/hooks/documents.update")
            .set("outline-signature", outlineSignature(body))
            .send(body);

        setTimeoutSpy.mockRestore();

        expect(noSignature.status).toBe(401);
        expect(badSignature.status).toBe(403);
        expect(validSignature.status).toBe(200);
    });
});
