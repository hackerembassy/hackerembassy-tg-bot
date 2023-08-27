/* eslint-disable @typescript-eslint/ban-types */

export function anyItemIsInList(items: any[], list: any[]) {
    return items.some(item => list.includes(item));
}

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function onlyUniqueFilter<T>(value: T, index: number, array: T[]) {
    return array.indexOf(value) === index;
}

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

export function stripCustomMarkup(text: string): string {
    return text.replaceAll(/#./g, "");
}

export function debounce(func: Function, delay: number) {
    let timeoutId: string | number | NodeJS.Timeout;

    return function () {
        clearTimeout(timeoutId);

        timeoutId = setTimeout(() => {
            // eslint-disable-next-line prefer-rest-params
            func.apply(this, arguments);
        }, delay);
    };
}
