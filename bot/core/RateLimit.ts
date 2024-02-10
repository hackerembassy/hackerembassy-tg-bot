/* eslint-disable @typescript-eslint/ban-types */
import config from "config";

import { BotConfig } from "../../config/schema";
import { sleep } from "../../utils/common";

const botConfig = config.get<BotConfig>("bot");

export const DEFAULT_USER_RATE_LIMIT = botConfig.rateLimits.user;
export const DEFAULT_API_RATE_LIMIT = botConfig.rateLimits.api;

export class UserRateLimiter {
    static #debounceTimerIds = new Map();
    static #limitTimerIds = new Map();
    static #cooldownTimerIds = new Map();

    static debounced(func: Function, userId: number, rateLimit = DEFAULT_USER_RATE_LIMIT): (...args: any) => void {
        return (...args: any) => {
            clearTimeout(UserRateLimiter.#debounceTimerIds.get(userId));

            const timerId = setTimeout(() => {
                func(...args);
                UserRateLimiter.#debounceTimerIds.delete(userId);
            }, rateLimit);

            UserRateLimiter.#debounceTimerIds.set(userId, timerId);
        };
    }

    static limited(func: Function, userId: number, rateLimit = DEFAULT_USER_RATE_LIMIT): (...args: any) => void {
        return (...args: any) => {
            const cooldown = UserRateLimiter.#limitTimerIds.get(userId);

            if (!cooldown) func(args);
            clearTimeout(cooldown);

            const timerId = setTimeout(() => {
                clearTimeout(cooldown);
                UserRateLimiter.#limitTimerIds.delete(userId);
            }, rateLimit);

            UserRateLimiter.#limitTimerIds.set(userId, timerId);
        };
    }

    static throttled(func: Function, userId: number, rateLimit = DEFAULT_USER_RATE_LIMIT): (...args: any) => Promise<void> {
        return async (...args: any) => {
            const cooldown = UserRateLimiter.#cooldownTimerIds.get(userId);

            if (!cooldown) {
                const timerId = setTimeout(() => {
                    clearTimeout(cooldown);
                    UserRateLimiter.#cooldownTimerIds.delete(userId);
                }, rateLimit);

                UserRateLimiter.#cooldownTimerIds.set(userId, timerId);

                await func(...args);
            }
        };
    }
}

export class RateLimiter {
    static async executeOverTime<T>(calls: (() => Promise<T>)[], rateLimit = DEFAULT_API_RATE_LIMIT): Promise<T[]> {
        const results: T[] = [];

        for (const call of calls) {
            results.push(await call());
            await sleep(rateLimit);
        }

        return results;
    }
}
