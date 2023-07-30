// Middleware

/**
 * @param {{ error: (arg0: { err: any; req: any; res: any; }) => void; }} logger
 */
function createErrorMiddleware(logger) {
    // eslint-disable-next-line no-unused-vars
    return function handleError(err, req, res, next) {
        logger.error({ err, req, res });
        res.status(500).json({ message: "Server error", error: err });
    };
}

module.exports = { createErrorMiddleware };
