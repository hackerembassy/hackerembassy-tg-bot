import { ErrorRequestHandler, RequestHandler } from "express";
import { Logger } from "winston";

export function createErrorMiddleware(logger: Logger): ErrorRequestHandler {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return function handleError(err, req, res, next) {
        logger.error({ err, req, res });
        res.status(500).json({ message: "Server error", error: err });
    };
}

export function createTokenSecuredMiddleware(logger: Logger, token: string | undefined): RequestHandler {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return function tokenSecured(req, res, next): void {
        if (!req.body?.token || req.body.token !== token) {
            logger.info(`Got request with invalid token`);
            res.status(401).send({ message: "Invalid token" });
            return;
        }

        next();
    };
}
