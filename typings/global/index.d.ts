declare global {
    type Optional<T> = T | undefined | null;
    type Nullable<T> = T | null;
    type AnyFunction = (...params: unknown[]) => unknown;
    type MakeRequired<T, Keys extends keyof T> = Omit<T, Keys> & Required<Pick<T, Keys>>;
    type RequestContext = Record<string, unknown>;
    type ExcludeMethods<T> = { [K in keyof T as T[K] extends AnyFunction ? never : K]: T[K] };

    namespace Express {
        interface Request {
            context?: RequestContext;
            authenticated?: boolean;
            entity?: EntityType;
            user?: unknown;
            token?: string;
        }
    }

    type RequestWithBody<T> = import("express").Request<
        import("express-serve-static-core").ParamsDictionary,
        unknown,
        T,
        unknown
    >;
    type EntityType = "hass" | "terminal" | "user";
}

export {};
