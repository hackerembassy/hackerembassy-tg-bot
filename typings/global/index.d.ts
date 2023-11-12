declare global {
    type Optional<T> = T | undefined | null;
    type Nullable<T> = T | null;
    type AnyFunction = (...params: any[]) => any;
}

export {};
