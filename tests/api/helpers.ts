import express, { RequestHandler, Router } from "express";

import { User } from "@data/models";
import apikeyRepository from "@data/repositories/apikeys";
import { generateRandomKey, sha256 } from "@utils/security";

// Each router is tiny and self-contained, so tests mount just the router under test on a fresh
// express app instead of pulling in the real app (which imports the bot singleton, swagger,
// prometheus, etc). Some routers (e.g. the bot's /api/embassy proxy) expect auth middleware to
// already have run before they're mounted, same as in the real app - pass it via `middleware`.
export function appWith(router: Router, mountPath = "/", middleware: RequestHandler[] = []) {
    const app = express();
    app.use(express.json());
    for (const mw of middleware) app.use(mw);
    app.use(mountPath, router);
    return app;
}

// Generic typed accessor for a Map<string, T> mocked wholesale via jest.mock(), where every
// method on T is a jest.fn(). Avoids re-declaring the same `as unknown as {...}` mock shape in
// every spec file that mocks a Map of hardware clients (e.g. AvailableConditioners, AvailablePrinters).
export function mockedMapValue<T extends object>(map: Map<string, T>, key: string): { [K in keyof T]: jest.Mock } {
    return map.get(key) as unknown as { [K in keyof T]: jest.Mock };
}

// Fixed test-only credentials matching the fixtures tests/jestSetup.ts sets on process.env
// (HASSAPIKEY/TERMINALAPIKEY/OUTLINE_SIGNING_SECRET) - kept in one place so spec files don't
// hardcode copies of the same magic strings.
export const HASS_TOKEN = "test-hass-api-key";
export const TERMINAL_TOKEN = "test-terminal-api-key";
export const OUTLINE_SIGNING_SECRET = "test-outline-signing-secret";

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
