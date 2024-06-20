import { ErrorRequestHandler, RequestHandler } from "express";
import { ParamsDictionary, Request } from "express-serve-static-core";
import { ParsedQs } from "qs";
import { Logger } from "winston";

// Optional type for a legacy hass module
type RequestWithOptionalTokenBody = Request<ParamsDictionary, any, Optional<{ token?: string }>, ParsedQs, Record<string, any>>;

export function createErrorMiddleware(logger: Logger): ErrorRequestHandler {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return function handleError(err: Error, req, res, _next) {
        logger.error({ err, req, res });
        res.status(500).json({ message: "Server error", error: err });
    };
}

export function createTokenSecuredMiddleware(logger: Logger, token?: string, allowAnonymous: boolean = false): RequestHandler {
    return function tokenSecured(req, res, next): void {
        req.authenticated = tokenPresent(req as RequestWithOptionalTokenBody, token);

        if (!allowAnonymous && !req.authenticated) {
            logger.info(`Got request with invalid token`);
            res.status(401).send({ message: "Invalid token" });
            return;
        }

        next();
    };
}

export function tokenPresent(req: RequestWithOptionalTokenBody, token?: string): boolean {
    return token ? req.headers["token"] === token || req.body?.token === token : false;
}
