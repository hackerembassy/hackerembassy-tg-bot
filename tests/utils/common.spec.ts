import { generateRandomKey, hashMD5, randomInteger, sha256, splitArray } from "@utils/common";

describe("utils/common", () => {
    describe("splitArray", () => {
        it("splits an array into chunks of the given size", () => {
            expect(splitArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
        });

        it("returns a single chunk when size exceeds the array length", () => {
            expect(splitArray([1, 2], 10)).toEqual([[1, 2]]);
        });

        it("returns an empty array for an empty input", () => {
            expect(splitArray([], 2)).toEqual([]);
        });
    });

    describe("randomInteger", () => {
        it("stays within the inclusive bounds", () => {
            for (let i = 0; i < 100; i++) {
                const value = randomInteger(1, 5);

                expect(value).toBeGreaterThanOrEqual(1);
                expect(value).toBeLessThanOrEqual(5);
                expect(Number.isInteger(value)).toBe(true);
            }
        });

        it("returns the only possible value when min equals max", () => {
            expect(randomInteger(3, 3)).toBe(3);
        });
    });

    describe("hashMD5", () => {
        it("hashes known input to the expected digest", () => {
            expect(hashMD5("hello")).toBe("5d41402abc4b2a76b9719d911017c592");
        });

        it("is deterministic for the same input", () => {
            expect(hashMD5("some data")).toBe(hashMD5("some data"));
        });

        it("differs for different input", () => {
            expect(hashMD5("a")).not.toBe(hashMD5("b"));
        });
    });

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
