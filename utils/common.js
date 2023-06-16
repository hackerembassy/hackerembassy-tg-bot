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
        let tmp = str.substr(0, size);
        let indexOfLastNewLine = tmp.lastIndexOf("\n");
        let chunkLength = indexOfLastNewLine > 0 ? indexOfLastNewLine : size;
        chunks.push(tmp.substr(0, chunkLength));
        str = str.substr(chunkLength);
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

module.exports = { anyItemIsInList, sleep, chunkSubstr, stripCustomMarkup };
