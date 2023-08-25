/**
 * @typedef {Object} DateObject
 * @property {number} day
 * @property {number} month
 * @property {number} year
 */

/**
 * @typedef {object} DateBoundary
 * @property {DateObject} from
 * @property {DateObject} to
 */

/**
 * @typedef {object} ElapsedTimeObject
 * @property {number} days
 * @property {number} hours
 * @property {number} minutes
 * @property {number} totalSeconds
 */

/**
 * @param {Date} date
 * @returns DateObject
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

/**
 * @param {Date} someDate
 * @returns {boolean}
 */
function isToday(someDate) {
    const today = new Date();
    return (
        someDate.getDate() == today.getDate() &&
        someDate.getMonth() == today.getMonth() &&
        someDate.getFullYear() == today.getFullYear()
    );
}

module.exports = { toDateObject, convertMinutesToHours, getMonthBoundaries, isToday };
