declare global {
    type Optional<T> = T | undefined | null;
    type Nullable<T> = T | null;
    type AnyFunction = (...params: any[]) => any;
    type MakeRequired<T, Keys extends keyof T> = Omit<T, Keys> & Required<Pick<T, Keys>>;
}

export {};
