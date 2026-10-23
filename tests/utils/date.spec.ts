import {
    getYesterday,
    hasBirthdayToday,
    hasBithdayThisMonth,
    isIsoDateString,
    parseLocalDateTime,
    parseLongDuration,
} from "@utils/date";

describe("utils/date", () => {
    describe("getYesterday", () => {
        afterEach(() => {
            jest.useRealTimers();
        });

        it("returns local midnight of the previous day", () => {
            jest.useFakeTimers();
            jest.setSystemTime(new Date(2024, 7, 15, 12, 30, 0)); // local: 2024-08-15 12:30

            const yesterday = getYesterday();

            expect(yesterday).toEqual(new Date(2024, 7, 14, 0, 0, 0, 0));
        });

        it("handles a month/year boundary", () => {
            jest.useFakeTimers();
            jest.setSystemTime(new Date(2024, 0, 1, 0, 30, 0)); // local: 2024-01-01 00:30

            const yesterday = getYesterday();

            expect(yesterday).toEqual(new Date(2023, 11, 31, 0, 0, 0, 0));
        });
    });

    describe("hasBirthdayToday", () => {
        beforeEach(() => {
            jest.useFakeTimers();
            jest.setSystemTime(new Date(2024, 7, 15, 12, 0, 0)); // local: 2024-08-15
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it("returns true when day and month match today", () => {
            expect(hasBirthdayToday("1999-08-15")).toBe(true);
            expect(hasBirthdayToday("2024-08-15")).toBe(true);
        });

        it("returns false when day or month does not match", () => {
            expect(hasBirthdayToday("1999-08-14")).toBe(false);
            expect(hasBirthdayToday("1999-08-16")).toBe(false);
            expect(hasBirthdayToday("1999-07-15")).toBe(false);
            expect(hasBirthdayToday("1999-09-15")).toBe(false);
        });

        it("returns false for bad input", () => {
            expect(hasBirthdayToday("")).toBe(false);
            expect(hasBirthdayToday(null)).toBe(false);
            expect(hasBirthdayToday("not-a-date")).toBe(false);
        });
    });

    describe("hasBithdayThisMonth", () => {
        beforeEach(() => {
            jest.useFakeTimers();
            jest.setSystemTime(new Date(2024, 7, 15, 12, 0, 0)); // local month: August
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it("returns true when birthday month matches current month", () => {
            expect(hasBithdayThisMonth("1999-08-01")).toBe(true);
            expect(hasBithdayThisMonth("2024-08-31")).toBe(true);
        });

        it("returns false when birthday month does not match", () => {
            expect(hasBithdayThisMonth("1999-07-15")).toBe(false);
            expect(hasBithdayThisMonth("1999-09-15")).toBe(false);
        });

        it("returns false for bad input", () => {
            expect(hasBithdayThisMonth("")).toBe(false);
            expect(hasBithdayThisMonth(null)).toBe(false);
            expect(hasBithdayThisMonth("not-a-date")).toBe(false);
        });
    });

    describe("isIsoDateString", () => {
        it("returns true for valid YYYY-MM-DD format", () => {
            expect(isIsoDateString("2024-01-01")).toBe(true);
            expect(isIsoDateString("1999-12-31")).toBe(true);
        });

        it("returns true for valid MM-DD format (year optional in current implementation)", () => {
            expect(isIsoDateString("01-01")).toBe(true);
            expect(isIsoDateString("12-31")).toBe(true);
        });

        it("returns false for invalid month and day values", () => {
            expect(isIsoDateString("2024-00-10")).toBe(false);
            expect(isIsoDateString("2024-13-10")).toBe(false);
            expect(isIsoDateString("00-10")).toBe(false);
            expect(isIsoDateString("2024-01-00")).toBe(false);
            expect(isIsoDateString("2024-01-32")).toBe(false);
            expect(isIsoDateString("01-32")).toBe(false);
        });

        it("returns false for malformed inputs", () => {
            expect(isIsoDateString("2024/01/01")).toBe(false);
            expect(isIsoDateString("2024-1-1")).toBe(false);
            expect(isIsoDateString("not-a-date")).toBe(false);
            expect(isIsoDateString("")).toBe(false);
            expect(isIsoDateString()).toBe(false);
        });
    });

    describe("parseLocalDateTime", () => {
        const reference = new Date(2026, 6, 14, 12, 0);

        it.each([
            ["14-07-2026 14:59", new Date(2026, 6, 14, 14, 59)],
            ["1.8.2026 9:05", new Date(2026, 7, 1, 9, 5)],
            ["17:30", new Date(2026, 6, 14, 17, 30)],
            ["00:00", new Date(2026, 6, 14, 0, 0)],
        ])("parses %s", (input, expected) => {
            expect(parseLocalDateTime(input, reference)).toEqual(expected);
        });

        it.each(["31-02-2026 10:00", "14-13-2026 10:00", "25:00", "12:60", "2026-07-14 10:00", "tomorrow", ""])(
            "rejects %s",
            input => {
                expect(parseLocalDateTime(input, reference)).toBeUndefined();
            }
        );
    });

    describe("parseLongDuration", () => {
        it.each([
            ["3h", 3 * 60 * 60 * 1000],
            ["2h30m", 150 * 60 * 1000],
            ["45m", 45 * 60 * 1000],
            ["1d12h", 36 * 60 * 60 * 1000],
        ])("parses %s", (input, expected) => {
            expect(parseLongDuration(input)).toBe(expected);
        });

        it.each(["", "3", "h", "3x", "30m2h"])("rejects %s", input => {
            expect(parseLongDuration(input)).toBeUndefined();
        });
    });
});
