import { formatValueForCurrency, parseMoneyValue, toBasicMoneyString } from "@services/domain/funds/currency";

describe("services/domain/funds/currency", () => {
    describe("parseMoneyValue", () => {
        it("parses plain numbers and strips thousands separators", () => {
            expect(parseMoneyValue("1000")).toBe(1000);
            expect(parseMoneyValue("1,000")).toBe(1000);
            expect(parseMoneyValue("1000.50")).toBe(1000.5);
        });

        it("scales k/тыс/тысяч/т shorthand by a thousand", () => {
            expect(parseMoneyValue("1k")).toBe(1000);
            expect(parseMoneyValue("10тыс")).toBe(10000);
            expect(parseMoneyValue("10т")).toBe(10000);
            expect(parseMoneyValue("5тысяч")).toBe(5000);
            expect(parseMoneyValue("1.5k")).toBe(1500);
            expect(parseMoneyValue("1,500k")).toBe(1500000);
        });

        it("returns NaN for input it can't parse, including internal whitespace", () => {
            expect(parseMoneyValue("abc")).toBeNaN();
            expect(parseMoneyValue("1 000")).toBeNaN();
        });

        it("treats an empty or blank string as zero", () => {
            expect(parseMoneyValue("")).toBe(0);
            expect(parseMoneyValue("  ")).toBe(0);
        });

        it("accepts negative values", () => {
            expect(parseMoneyValue("-500")).toBe(-500);
        });
    });

    describe("formatValueForCurrency", () => {
        it("rounds to the configured fraction digits for known currencies", () => {
            expect(formatValueForCurrency(10.567, "USD")).toBe(10.57);
            expect(formatValueForCurrency(10.9, "AMD")).toBe(11);
            expect(formatValueForCurrency(0.123456789, "BTC")).toBe(0.12345679);
        });

        it("defaults to 4 fraction digits for an unlisted currency", () => {
            expect(formatValueForCurrency(1.23456789, "XYZ")).toBe(1.2346);
        });
    });

    describe("toBasicMoneyString", () => {
        it("strips decimals for whole numbers (stripIfInteger)", () => {
            expect(toBasicMoneyString(10)).toBe("10");
            expect(toBasicMoneyString(0)).toBe("0");
        });

        it("preserves existing decimals without grouping separators", () => {
            expect(toBasicMoneyString(10.5)).toBe("10.50");
            expect(toBasicMoneyString(-5.1)).toBe("-5.10");
        });
    });
});
