import { createHmac } from "crypto";

import { RequestHandler } from "express";

import { User } from "@data/models";
import { UserRole } from "@data/types";
import { SERVICE_USERS } from "@data/seed";
import ApiKeyRepository from "@repositories/apikeys";
import logger from "@services/logger";
import { sha256 } from "@utils/security";
import { extractToken, RequestWithOptionalTokenBody } from "@utils/express";
import { MINUTE } from "@utils/date";
import { safeJsonStringify } from "@utils/text";
import { hasRole } from "@services/user";

export function createAuthentificationMiddlware(): RequestHandler {
    return function authn(req, res, next): void {
        req.token = extractToken(req as RequestWithOptionalTokenBody);

        if (req.token) {
            if (req.token === process.env["UNLOCKKEY"]) {
                req.entity = "hass";
                req.user = SERVICE_USERS.hass;
            } else {
                const userkey = ApiKeyRepository.getUserByApiKey(sha256(req.token));
                if (userkey) {
                    ApiKeyRepository.updateKeyLastUsed(userkey.id);
                    req.entity = "user";
                    req.user = userkey.user as User;
                }
            }
        }

        next();
    };
}

export function createAuthorizationMiddleware(userroles: UserRole[]): RequestHandler {
    return function authz(req, res, next): void {
        if (!req.token) {
            logger.info(`Got request without authentication from ${req.ip}`);
            res.sendStatus(401);
            return;
        }

        const allowed = req.entity && (req.entity === "hass" || hasRole(req.user as User, ...userroles));

        if (!allowed) {
            logger.info(`Got request with invalid token from ${req.ip}`);
            res.sendStatus(403);
            return;
        }

        next();
    };
}

export function createOutlineVerificationMiddleware(token?: string): RequestHandler {
    return function outlineVerification(req, res, next): void {
        if (!token) throw new Error("Outline signing secret is required for outline verification");

        const header = req.headers["outline-signature"] as string | undefined;

        if (!header) {
            logger.error(`Got request without outline signature from ${req.ip}`);
            res.status(401).send({ message: "Outline signature is required" });
            return;
        }

        const [timestamp, signature] = header.split(",").map(part => part.split("=")[1]);
        const parsedTimestamp = Number(timestamp);

        if (isNaN(parsedTimestamp) || parsedTimestamp < Date.now() - MINUTE) {
            logger.error(`Got request with outdated outline signature from ${req.ip}`);
            res.status(401).send({ message: "Request is outdated" });
            return;
        }

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

// Middleware Instances
export const authentificate = createAuthentificationMiddlware();
export const allowMembers = createAuthorizationMiddleware(["member"]);
export const allowTrustedMembers = createAuthorizationMiddleware(["member", "trusted"]);
