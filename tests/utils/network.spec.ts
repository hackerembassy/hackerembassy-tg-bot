import { Response } from "node-fetch";

// @utils/network is globally mocked in jestSetup.ts (it's network/hardware-facing and pulls in
// heavy deps like node-ssh/mqtt/ping), so its pure helpers are pulled in directly via
// requireActual rather than the normal import.
const { isValidMAC, successOrThrow } = jest.requireActual<typeof import("@utils/network")>("@utils/network");

describe("utils/network", () => {
    describe("isValidMAC", () => {
        it("accepts colon and dash separated MAC addresses", () => {
            expect(isValidMAC("70:85:C2:75:12:4C")).toBe(true);
            expect(isValidMAC("70-85-C2-75-12-4C")).toBe(true);
        });

        it("rejects malformed input", () => {
            expect(isValidMAC("not-a-mac")).toBe(false);
            expect(isValidMAC("70:85:C2:75:12")).toBe(false);
            expect(isValidMAC("")).toBe(false);
        });
    });

    describe("successOrThrow", () => {
        it("returns true for an ok response", () => {
            const response = new Response(null, { status: 200 });

            expect(successOrThrow(response)).toBe(true);
        });

        it("throws for a non-ok response", () => {
            const response = new Response(null, { status: 500, url: "https://example.com" } as never);

            expect(() => successOrThrow(response)).toThrow();
        });
    });
});
