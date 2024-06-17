declare global {
    type Optional<T> = T | undefined | null;
    type Nullable<T> = T | null;
    type AnyFunction = (...params: any[]) => any;
    type MakeRequired<T, Keys extends keyof T> = Omit<T, Keys> & Required<Pick<T, Keys>>;
    type RequestContext = Record<string, any>;

    namespace Express {
        interface Request {
            context?: RequestContext;
            authenticated?: boolean;
        }
    }

    type RequestWithBody<T> = import("express").Request<import("express-serve-static-core").ParamsDictionary, any, T, any>;
}

export {};
