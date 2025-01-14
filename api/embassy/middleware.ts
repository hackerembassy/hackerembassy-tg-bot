import { RequestHandler } from "express";
import { Request } from "express-serve-static-core";

import { decrypt } from "@utils/security";
import logger from "@services/logger";

// Because we are too lazy to setup https on the embassy service
export function createEncryptedAuthMiddleware(): RequestHandler {
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

        if (decrypted !== process.env["UNLOCKKEY"]) {
            logger.info(`Got request with invalid token`);
            res.status(403).send({ message: "Invalid token" });
            return;
        }

        next();
    };
}
