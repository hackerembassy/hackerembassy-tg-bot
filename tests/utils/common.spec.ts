import { hashMD5, randomInteger, splitArray } from "@utils/common";

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
});
