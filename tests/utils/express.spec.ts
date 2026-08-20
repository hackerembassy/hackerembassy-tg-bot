import { Request } from "express";

import { extractToken, getRequestIp, RequestWithOptionalTokenBody } from "@utils/express";

function fakeRequest(overrides: Record<string, unknown>): RequestWithOptionalTokenBody {
    return { headers: {}, ...overrides } as unknown as RequestWithOptionalTokenBody;
}

describe("utils/express", () => {
    describe("extractToken", () => {
        it("reads a bearer token from the Authorization header", () => {
            const req = fakeRequest({ headers: { authorization: "Bearer abc123" } });

            expect(extractToken(req)).toBe("abc123");
        });

        it("falls back to a token header", () => {
            const req = fakeRequest({ headers: { token: "abc123" } });

            expect(extractToken(req)).toBe("abc123");
        });

        it("falls back to a token in the body", () => {
            const req = fakeRequest({ headers: {}, body: { token: "abc123" } });

            expect(extractToken(req)).toBe("abc123");
        });

        it("returns undefined when no token is present", () => {
            const req = fakeRequest({ headers: {}, body: {} });

            expect(extractToken(req)).toBeUndefined();
        });
    });

    describe("getRequestIp", () => {
        it("prefers X-Forwarded-For when present", () => {
            const req = {
                headers: { "x-forwarded-for": "1.2.3.4" },
                socket: { remoteAddress: "5.6.7.8" },
            } as unknown as Request;

            expect(getRequestIp(req)).toBe("1.2.3.4");
        });

        it("falls back to the socket's remote address", () => {
            const req = {
                headers: {},
                socket: { remoteAddress: "5.6.7.8" },
            } as unknown as Request;

            expect(getRequestIp(req)).toBe("5.6.7.8");
        });
    });
});
