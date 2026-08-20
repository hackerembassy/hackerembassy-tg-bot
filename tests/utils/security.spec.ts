import { generateRandomKey, sha256 } from "@utils/security";

describe("utils/security", () => {
    describe("sha256", () => {
        it("hashes known input to the expected digest", () => {
            expect(sha256("hello")).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
        });

        it("is deterministic for the same input", () => {
            expect(sha256("some data")).toBe(sha256("some data"));
        });

        it("differs for different input", () => {
            expect(sha256("a")).not.toBe(sha256("b"));
        });
    });

    describe("generateRandomKey", () => {
        it("generates a hex string of the requested byte size", () => {
            const key = generateRandomKey(16);

            expect(key).toMatch(/^[0-9a-f]+$/);
            expect(key).toHaveLength(32);
        });

        it("generates different keys on each call", () => {
            expect(generateRandomKey()).not.toBe(generateRandomKey());
        });
    });
});
