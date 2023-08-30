/* eslint-disable @typescript-eslint/ban-types */
import config from "config";

import { BotConfig } from "../config/schema";

const botConfig = config.get("bot") as BotConfig;
const DEFAULT_RATE_LIMIT = botConfig.rateLimit ?? 500;

export default class RateLimiter {
    static #debounceTimerIds = new Map();
    static #limitTimerIds = new Map();
    static #cooldownTimerIds = new Map();

    static debounced(func: Function, userId: number, rateLimit = DEFAULT_RATE_LIMIT) {
        return (...args: any) => {
            clearTimeout(RateLimiter.#debounceTimerIds.get(userId));

            const timerId = setTimeout(() => {
                func(...args);
                RateLimiter.#debounceTimerIds.delete(userId);
            }, rateLimit);

            RateLimiter.#debounceTimerIds.set(userId, timerId);
        };
    }

    static limited(func: Function, userId: number, rateLimit = DEFAULT_RATE_LIMIT) {
        return (...args: any) => {
            const cooldown = RateLimiter.#limitTimerIds.get(userId);

            if (!cooldown) func(args);
            clearTimeout(cooldown);

            const timerId = setTimeout(() => {
                clearTimeout(cooldown);
                RateLimiter.#limitTimerIds.delete(userId);
            }, rateLimit);

            RateLimiter.#limitTimerIds.set(userId, timerId);
        };
    }

    static throttled(func: Function, userId: number, rateLimit = DEFAULT_RATE_LIMIT) {
        return async (...args: any) => {
            const cooldown = RateLimiter.#cooldownTimerIds.get(userId);

            if (!cooldown) {
                const timerId = setTimeout(() => {
                    clearTimeout(cooldown);
                    RateLimiter.#cooldownTimerIds.delete(userId);
                }, rateLimit);

                RateLimiter.#cooldownTimerIds.set(userId, timerId);

                await func(...args);
            }
        };
    }
}
