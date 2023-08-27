/* eslint-disable @typescript-eslint/ban-types */
/**
 * @param {any[]} items
 * @param {any[]} list
 */
export function anyItemIsInList(items: any[], list: any[]) {
    return items.some(item => list.includes(item));
}

/**
 * @param {number} ms
 */
export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * @template T
 * @param {T} value
 * @param {number} index
 * @param {T[]} array
 */
export function onlyUniqueFilter<T>(value: T, index: number, array: T[]) {
    return array.indexOf(value) === index;
}

/**
 * @param {string} str
 * @param {number} size
 */
export function chunkSubstr(str: string, size: number) {
    const chunks = [];

    if (str.length < size) return [str];

    while (str.length > 0) {
        const tmp = str.substring(0, size);
        const indexOfLastNewLine = tmp.lastIndexOf("\n");
        const chunkLength = indexOfLastNewLine > 0 ? indexOfLastNewLine + 1 : size;
        chunks.push(tmp.substring(0, chunkLength));
        str = str.substring(chunkLength);
    }

    return chunks;
}

/**
 * @param {string} text
 * @returns {string}
 */
export function stripCustomMarkup(text: string): string {
    return text.replaceAll(/#./g, "");
}

/**
 * @param {function} func
 * @param {number} delay
 */
export function debounce(func: Function, delay: number) {
    let timeoutId;

    return function () {
        clearTimeout(timeoutId);

        timeoutId = setTimeout(() => {
            // eslint-disable-next-line prefer-rest-params
            func.apply(this, arguments);
        }, delay);
    };
}
