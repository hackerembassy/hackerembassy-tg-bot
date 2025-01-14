declare global {
    type Optional<T> = T | undefined | null;
    type Nullable<T> = T | null;
    type AnyFunction = (...params: any[]) => any;
    type MakeRequired<T, Keys extends keyof T> = Omit<T, Keys> & Required<Pick<T, Keys>>;
    type RequestContext = Record<string, any>;
    type ExcludeMethods<T> = { [K in keyof T as T[K] extends AnyFunction ? never : K]: T[K] };

    namespace Express {
        interface Request {
            context?: RequestContext;
            authenticated?: boolean;
            entity?: EntityType;
            user?: any;
            token?: string;
        }
    }

    type RequestWithBody<T> = import("express").Request<import("express-serve-static-core").ParamsDictionary, any, T, any>;
    type EntityType = "hass" | "user";
}

export {};
