import { anyItemIsInList, filterFulfilled, isDefined, onlyUniqueFilter, onlyUniqueInsFilter } from "@utils/filters";

describe("utils/filters", () => {
    describe("anyItemIsInList", () => {
        it("returns true when at least one item is in the list", () => {
            expect(anyItemIsInList([1, 2], [2, 3])).toBe(true);
        });

        it("returns false when no items are in the list", () => {
            expect(anyItemIsInList([1, 2], [3, 4])).toBe(false);
        });
    });

    describe("onlyUniqueFilter", () => {
        it("removes duplicate values", () => {
            expect([1, 2, 2, 3, 1].filter(onlyUniqueFilter)).toEqual([1, 2, 3]);
        });
    });

    describe("onlyUniqueInsFilter", () => {
        it("removes duplicates case-insensitively", () => {
            expect(["Guest", "guest", "Admin"].filter(onlyUniqueInsFilter)).toEqual(["Guest", "Admin"]);
        });
    });

    describe("filterFulfilled", () => {
        it("keeps only fulfilled settled results", async () => {
            const results = await Promise.allSettled([Promise.resolve(1), Promise.reject(new Error("fail")), Promise.resolve(3)]);

            expect(filterFulfilled(results).map(r => r.value)).toEqual([1, 3]);
        });
    });

    describe("isDefined", () => {
        it("filters out undefined values while keeping falsy-but-defined ones", () => {
            expect([1, undefined, 0, undefined, "a"].filter(isDefined)).toEqual([1, 0, "a"]);
        });
    });
});
