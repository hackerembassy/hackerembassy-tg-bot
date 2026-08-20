import express, { Router } from "express";

import { User } from "@data/models";
import apikeyRepository from "@data/repositories/apikeys";
import { generateRandomKey, sha256 } from "@utils/security";

// Each router is tiny and self-contained, so tests mount just the router under test on a fresh
// express app instead of pulling in the real app (which imports the bot singleton, swagger,
// prometheus, etc).
export function appWith(router: Router, mountPath = "/") {
    const app = express();
    app.use(express.json());
    app.use(mountPath, router);
    return app;
}

// Mirrors how real API keys are issued: a random key is handed to the caller, only its hash is
// stored (see ApiKeyRepository/middleware.ts), and it's looked up via the Authorization header.
export function issueApiKey(user: User): string {
    const rawKey = generateRandomKey();
    apikeyRepository.addKey(user.userid, sha256(rawKey));

    return rawKey;
}

export function bearer(token: string) {
    return { Authorization: `Bearer ${token}` };
}
