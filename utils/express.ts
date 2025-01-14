import { ErrorRequestHandler, RequestHandler } from "express";
import { ParamsDictionary, Request } from "express-serve-static-core";
import { ParsedQs } from "qs";
import { Logger } from "winston";

// Optional type for a legacy hass module
export type RequestWithOptionalTokenBody = Request<
    ParamsDictionary,
    any,
    Optional<{ token?: string }>,
    ParsedQs,
    Record<string, any>
>;

export function createErrorMiddleware(logger: Logger): ErrorRequestHandler {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return function handleError(err: Error, req, res, _next) {
        if (err instanceof SyntaxError && "status" in err && "body" in err && err.status === 400) {
            // Check for syntax errors from body-parser
            res.status(400).send({ error: "Invalid JSON in body" });
            return;
        }

        logger.error({ err, req, res });
        res.status(500).json({ message: "Server error", error: err });
    };
}

export function createDebugMiddleware(): RequestHandler {
    return function debug(req, res, next): void {
        // eslint-disable-next-line no-console
        console.log(req);
        next();
    };
}

// Supports token in headers, query params, and body for legacy hass modules
export function extractToken(req: RequestWithOptionalTokenBody): string | undefined {
    if (req.headers.authorization?.startsWith("Bearer ")) return req.headers.authorization.slice(7);

    if (typeof req.headers["token"] === "string") return req.headers["token"];

    return req.body?.token;
}
