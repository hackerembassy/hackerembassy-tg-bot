import crypto, { BinaryLike } from "crypto";

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// @typescript-eslint/no-unsafe-function-type
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export function debounce(func: Function, delay: number): (...args: any[]) => void {
    let timeoutId: string | number | NodeJS.Timeout;

    return function (...args) {
        clearTimeout(timeoutId);

        timeoutId = setTimeout(() => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call
            func(...args);
        }, delay);
    };
}

export function randomInteger(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function splitArray<T>(array: T[], size: number): T[][] {
    const result = [];

    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }

    return result;
}

export function hashMD5(data: BinaryLike) {
    const hash = crypto.createHash("md5");
    hash.update(data);
    return hash.digest("hex");
}
