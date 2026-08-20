import { chunkSubstr, cropStringAtSpace, equalsIns, isEmoji, safeJsonParse, safeJsonStringify } from "@utils/text";

describe("utils/text", () => {
    describe("isEmoji", () => {
        it("accepts a single emoji, including multi-codepoint ones like flags", () => {
            expect(isEmoji("🎉")).toBe(true);
            expect(isEmoji("🇺🇸")).toBe(true);
            expect(isEmoji("❤️")).toBe(true); // U+2764 + variation selector
        });

        it("accepts emoji added after the original character ranges were written", () => {
            expect(isEmoji("🫠")).toBe(true); // Symbols and Pictographs Extended-A (U+1FA00-1FAFF)
        });

        it("rejects text that merely contains an emoji rather than being one", () => {
            // setemojiHandler stores this value verbatim as the user's status emoji, so it must not
            // accept a whole sentence just because it has an emoji in it somewhere.
            expect(isEmoji("Party 🎉 time")).toBe(false);
            expect(isEmoji("🎉 ")).toBe(false);
        });

        it("returns false for plain text", () => {
            expect(isEmoji("hello")).toBe(false);
            expect(isEmoji("")).toBe(false);
        });
    });

    describe("equalsIns", () => {
        it("compares strings case-insensitively", () => {
            expect(equalsIns("Guest", "guest")).toBe(true);
            expect(equalsIns("Guest", "admin")).toBe(false);
        });

        it("handles null/undefined", () => {
            expect(equalsIns(null, null)).toBe(true);
            expect(equalsIns(null, "guest")).toBe(false);
        });
    });

    describe("cropStringAtSpace", () => {
        it("returns the string unchanged when under the limit", () => {
            expect(cropStringAtSpace("short text", 30)).toBe("short text");
        });

        it("crops at the last space before the limit", () => {
            expect(cropStringAtSpace("a fairly long sentence to crop", 20)).toBe("a fairly long");
        });

        it("falls back to an ellipsis when there is no space to crop at", () => {
            expect(cropStringAtSpace("supercalifragilisticexpialidocious", 10)).toBe("superca...");
        });
    });

    describe("chunkSubstr", () => {
        it("returns the whole string as one chunk when under the size", () => {
            expect(chunkSubstr("short", 100)).toEqual(["short"]);
        });

        it("splits long text into chunks no larger than size", () => {
            const chunks = chunkSubstr("a".repeat(25), 10);

            expect(chunks.join("")).toBe("a".repeat(25));
            expect(chunks.every(chunk => chunk.length <= 10)).toBe(true);
        });

        it("prefers to break at the last newline within a chunk", () => {
            const chunks = chunkSubstr("1234\n6789", 8);

            expect(chunks).toEqual(["1234\n", "6789"]);
        });
    });

    describe("safeJsonParse / safeJsonStringify", () => {
        it("parses valid JSON", () => {
            expect(safeJsonParse<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
        });

        it("returns undefined for invalid JSON instead of throwing", () => {
            expect(safeJsonParse("not json")).toBeUndefined();
        });

        it("stringifies plain objects", () => {
            expect(safeJsonStringify({ a: 1 })).toBe('{"a":1}');
        });

        it("returns undefined for circular structures instead of throwing", () => {
            const circular: Record<string, unknown> = {};
            circular["self"] = circular;

            expect(safeJsonStringify(circular)).toBeUndefined();
        });
    });
});
