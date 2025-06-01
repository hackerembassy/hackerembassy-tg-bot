import { TOptions } from "i18next";

export interface DateObject {
    day: number;
    month: number;
    year: number;
}

export interface DateBoundary extends TOptions {
    from: DateObject;
    to: DateObject;
}

export interface ElapsedTimeObject {
    days: number;
    hours: number;
    minutes: number;
    totalSeconds: number;
}

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const HALFDAY = 12 * HOUR;
export const DAY = 24 * HOUR;
export const WEEK = 7 * DAY;
export const MONTH = 30 * DAY;

export const DURATION_STRING_REGEX = /(?:(\d+)h\s?)?(?:(\d+)m)?/;

export const shortDateTimeOptions: Intl.DateTimeFormatOptions = {
    dateStyle: "short",
    timeStyle: "short",
};

export const onlyTimeOptions: Intl.DateTimeFormatOptions = {
    dateStyle: undefined,
    timeStyle: "short",
};

export const onlyDateOptions: Intl.DateTimeFormatOptions = {
    dateStyle: "short",
    timeStyle: undefined,
};

export function toDateObject(date: Date): DateObject {
    return { day: date.getDate(), month: date.getMonth() + 1, year: date.getFullYear() };
}

export function durationStringToMs(durationString: string): number | undefined {
    const duration = RegExp(DURATION_STRING_REGEX).exec(durationString);

    if (!duration) throw new Error(`Invalid duration string: ${durationString}`);

    const hours = duration[1] ? parseInt(duration[1]) : 0;
    const minutes = duration[2] ? parseInt(duration[2]) : 0;

    return (hours * 60 + minutes) * MINUTE;
}

export function tryDurationStringToMs(durationString: string): number | undefined {
    try {
        return durationStringToMs(durationString);
    } catch {
        return undefined;
    }
}

export function convertMinutesToHours(minutes: number): string | undefined {
    if (isNaN(minutes) || !isFinite(minutes)) return undefined;

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return hours + "h " + remainingMinutes.toFixed(0) + "m";
}

export function convertToElapsedObject(seconds: number): ElapsedTimeObject {
    return {
        days: Math.floor(seconds / (3600 * 24)),
        hours: Math.floor((seconds % (3600 * 24)) / 3600),
        minutes: Math.floor((seconds % 3600) / 60),
        totalSeconds: seconds,
    };
}

export function getMonthBoundaries(date: Date): { startMonthDate: Date; endMonthDate: Date } {
    const startMonthDate = new Date(date);
    startMonthDate.setUTCDate(1);
    const endMonthDate = new Date(date);
    endMonthDate.setUTCMonth(endMonthDate.getMonth() + 1);
    endMonthDate.setUTCDate(0);
    endMonthDate.setUTCHours(23, 59, 59, 999);

    return { startMonthDate, endMonthDate };
}

export function isToday(someDate: Date, ignoreYear: boolean = false): boolean {
    const today = new Date();
    return (
        someDate.getDate() === today.getDate() &&
        someDate.getMonth() === today.getMonth() &&
        (ignoreYear || someDate.getFullYear() === today.getFullYear())
    );
}

export function getToday(): Date {
    const date = new Date();
    date.setHours(0, 0, 0, 0);

    return date;
}

export function shiftedToUTC4(date: Date): Date {
    const utcDate = new Date(date);
    utcDate.setHours(utcDate.getHours() + 4 + utcDate.getTimezoneOffset() / 60);

    return utcDate;
}

const monthMap = new Map([
    ["январь", 1],
    ["февраль", 2],
    ["март", 3],
    ["апрель", 4],
    ["май", 5],
    ["июнь", 6],
    ["июль", 7],
    ["август", 8],
    ["сентябрь", 9],
    ["октябрь", 10],
    ["ноябрь", 11],
    ["декабрь", 12],
]);

export function compareMonthNames(a: string, b: string) {
    const monthA = monthMap.get(a.toLowerCase());
    const monthB = monthMap.get(b.toLowerCase());

    if (!monthA || !monthB) throw new Error(`Invalid month ${a} or ${b}`);

    return monthA - monthB;
}

const LOCALE_ISO_DATE_FORMAT = "sv";
const DATE_SUBSTRING_INDICES: [number, number] = [5, 10];

export function hasBirthdayToday(date: Nullable<string>) {
    if (!date) return false;

    const currentDate = new Date().toLocaleDateString(LOCALE_ISO_DATE_FORMAT).substring(...DATE_SUBSTRING_INDICES);

    return date.substring(5, 10) === currentDate;
}

export function isIsoDateString(date?: string) {
    return date ? /^(?:\d{4}-)?(0[1-9]|1[0-2])-(0[1-9]|[1-2]\d|3[0-1])$/.test(date) : false;
}
