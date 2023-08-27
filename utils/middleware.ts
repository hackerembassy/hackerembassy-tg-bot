import { Logger } from "winston";

export function createErrorMiddleware(logger: Logger) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return function handleError(err, req, res, next) {
        logger.error({ err, req, res });
        res.status(500).json({ message: "Server error", error: err });
    };
}
