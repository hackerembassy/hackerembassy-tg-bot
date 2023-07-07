/**
 * @param {any[]} items
 * @param {any[]} list
 */
function anyItemIsInList(items, list) {
    return items.some(item => list.includes(item));
}

/**
 * @param {number} ms
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * @param {string} str
 * @param {number} size
 */
function chunkSubstr(str, size) {
    const chunks = [];

    if (str.length < size) return [str];

    while (str.length > 0) {
        let tmp = str.substring(0, size);
        let indexOfLastNewLine = tmp.lastIndexOf("\n");
        let chunkLength = indexOfLastNewLine > 0 ? indexOfLastNewLine : size;
        chunks.push(tmp.substring(0, chunkLength));
        str = str.substring(chunkLength);
    }

    return chunks;
}

/**
 * @param {string} text
 * @returns {string}
 */
function stripCustomMarkup(text) {
    return text.replaceAll(/#./g, "");
}

/**
 * @param {function} func
 * @param {number} delay
 */
function debounce(func, delay) {
    let timeoutId;

    return function () {
        clearTimeout(timeoutId);

        timeoutId = setTimeout(() => {
            func.apply(this, arguments);
        }, delay);
    };
}

module.exports = { anyItemIsInList, sleep, chunkSubstr, stripCustomMarkup, debounce };
