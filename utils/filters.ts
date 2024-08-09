export function anyItemIsInList<T>(items: T[], list: T[]) {
    return items.some(item => list.includes(item));
}

export function onlyUniqueFilter<T>(value: T, index: number, array: T[]) {
    return array.indexOf(value) === index;
}

export function onlyUniqueInsFilter(value: string, index: number, array: string[]) {
    return array.findIndex(item => item.toLowerCase() === value.toLowerCase()) === index;
}

export function filterFulfilled<T>(results: PromiseSettledResult<T>[]): PromiseFulfilledResult<T>[] {
    return results.filter(result => result.status === "fulfilled");
}
