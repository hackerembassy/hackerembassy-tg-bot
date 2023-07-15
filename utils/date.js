/**
 * @param {Date} date
 */
function toDateObject(date) {
    return { day: date.getDate(), month: date.getMonth() + 1, year: date.getFullYear() };
}

/**
 * @param {number} minutes
 * @returns {string}
 */
function convertMinutesToHours(minutes) {
    if (isNaN(minutes) || !isFinite(minutes)) return;

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return hours + "h " + remainingMinutes.toFixed(0) + "m";
}

/**
 * @param {Date} date
 */
function getMonthBoundaries(date) {
    let startMonthDate = new Date(date);
    startMonthDate.setDate(1);
    let endMonthDate = new Date(date);
    endMonthDate.setMonth(endMonthDate.getMonth() + 1);
    endMonthDate.setDate(0);

    return { startMonthDate, endMonthDate };
}

module.exports = { toDateObject, convertMinutesToHours, getMonthBoundaries };
