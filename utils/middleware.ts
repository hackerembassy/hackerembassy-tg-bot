import { createHmac } from "crypto";

import { ErrorRequestHandler, RequestHandler } from "express";
import { ParamsDictionary, Request } from "express-serve-static-core";
import { ParsedQs } from "qs";
import { Logger } from "winston";

import { decrypt } from "./security";
import { safeJsonStringify } from "./text";

// Optional type for a legacy hass module
type RequestWithOptionalTokenBody = Request<ParamsDictionary, any, Optional<{ token?: string }>, ParsedQs, Record<string, any>>;

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

// Because we are to lazy to setup https on the embassy service
export function createEncryptedAuthMiddleware(logger: Logger, token?: string): RequestHandler {
    return async function encryptedAuth(req: Request, res, next) {
        if (!req.headers.authorization) {
            logger.info(`Got request without authorization header`);
            res.status(401).send({ message: "Authorization header is required" });
            return;
        }

        const auth = req.headers.authorization.toString().replace("Bearer ", "");

        if (!auth) {
            logger.info(`Got request with empty authorization header`);
            res.status(401).send({ message: "Authorization token is required" });
            return;
        }

        const decrypted = await decrypt(auth);

        if (decrypted !== token) {
            logger.info(`Got request with invalid token`);
            res.status(401).send({ message: "Invalid token" });
            return;
        }

        next();
    };
}

export function createOutlineVerificationMiddleware(logger: Logger, token?: string): RequestHandler {
    return function outlineVerification(req, res, next): void {
        if (!token) throw new Error("Outline signing secret is required for outline verification");

        const header = req.headers["outline-signature"] as string | undefined;

        if (!header) {
            logger.error(`Got request without outline signature from ${req.ip}`);
            res.status(401).send({ message: "Outline signature is required" });
            return;
        }

        const [timestamp, signature] = header.split(",").map(part => part.split("=")[1]);
        const bodyString = safeJsonStringify(req.body);

        if (!bodyString) {
            res.status(400).send({ message: "Invalid body" });
            return;
        }

        const calculatedSignature = createHmac("sha256", token).update(`${timestamp}.${bodyString}`).digest("hex");

        if (calculatedSignature !== signature) {
            logger.error(`Got request with invalid outline signature from ${req.ip}`);
            res.status(403).send({ message: "Invalid outline signature" });
            return;
        }

        next();
    };
}

export function tokenPresent(req: RequestWithOptionalTokenBody, token?: string): boolean {
    return token ? req.headers["token"] === token || req.body?.token === token : false;
}
