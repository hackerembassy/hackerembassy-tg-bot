export interface DateObject {
    day: number;
    month: number;
    year: number;
}

export interface DateBoundary {
    from: DateObject;
    to: DateObject;
}

export interface ElapsedTimeObject {
    days: number;
    hours: number;
    minutes: number;
    totalSeconds: number;
}

export function toDateObject(date: Date): DateObject {
    return { day: date.getDate(), month: date.getMonth() + 1, year: date.getFullYear() };
}

export function convertMinutesToHours(minutes: number): string | undefined {
    if (isNaN(minutes) || !isFinite(minutes)) return undefined;

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return hours + "h " + remainingMinutes.toFixed(0) + "m";
}

export function getMonthBoundaries(date: Date): { startMonthDate: Date; endMonthDate: Date } {
    const startMonthDate = new Date(date);
    startMonthDate.setDate(1);
    const endMonthDate = new Date(date);
    endMonthDate.setMonth(endMonthDate.getMonth() + 1);
    endMonthDate.setDate(0);

    return { startMonthDate, endMonthDate };
}

export function isToday(someDate: Date): boolean {
    const today = new Date();
    return (
        someDate.getDate() == today.getDate() &&
        someDate.getMonth() == today.getMonth() &&
        someDate.getFullYear() == today.getFullYear()
    );
}
