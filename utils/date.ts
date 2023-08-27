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

/**
 * @param {Date} date
 * @returns DateObject
 */
export function toDateObject(date: Date) {
    return { day: date.getDate(), month: date.getMonth() + 1, year: date.getFullYear() };
}

/**
 * @param {number} minutes
 * @returns {string}
 */
export function convertMinutesToHours(minutes: number): string {
    if (isNaN(minutes) || !isFinite(minutes)) return;

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return hours + "h " + remainingMinutes.toFixed(0) + "m";
}

/**
 * @param {Date} date
 */
export function getMonthBoundaries(date: Date) {
    const startMonthDate = new Date(date);
    startMonthDate.setDate(1);
    const endMonthDate = new Date(date);
    endMonthDate.setMonth(endMonthDate.getMonth() + 1);
    endMonthDate.setDate(0);

    return { startMonthDate, endMonthDate };
}

/**
 * @param {Date} someDate
 * @returns {boolean}
 */
export function isToday(someDate: Date): boolean {
    const today = new Date();
    return (
        someDate.getDate() == today.getDate() &&
        someDate.getMonth() == today.getMonth() &&
        someDate.getFullYear() == today.getFullYear()
    );
}
