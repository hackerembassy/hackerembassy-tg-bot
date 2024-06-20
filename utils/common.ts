export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function debounce(func: Function, delay: number): (...args: any[]) => void {
    let timeoutId: string | number | NodeJS.Timeout;

    return function (...args) {
        clearTimeout(timeoutId);

        timeoutId = setTimeout(() => {
            // eslint-disable-next-line prefer-rest-params
            func(...args);
        }, delay);
    };
}
