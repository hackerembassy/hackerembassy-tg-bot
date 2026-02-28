import { hasBirthdayToday, hasBithdayThisMonth, isIsoDateString } from "@utils/date";

describe("utils/date", () => {
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
            expect(isIsoDateString(undefined)).toBe(false);
        });
    });
});
