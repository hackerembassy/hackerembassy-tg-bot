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
            clearTimeout(this.#debounceTimerIds.get(userId));

            const timerId = setTimeout(() => {
                func(...args);
                this.#debounceTimerIds.delete(userId);
            }, rateLimit);

            this.#debounceTimerIds.set(userId, timerId);
        };
    }

    static limited(func: Function, userId: number, rateLimit = DEFAULT_RATE_LIMIT) {
        return (...args: any) => {
            const cooldown = this.#limitTimerIds.get(userId);

            if (!cooldown) func(args);
            clearTimeout(cooldown);

            const timerId = setTimeout(() => {
                clearTimeout(cooldown);
                this.#limitTimerIds.delete(userId);
            }, rateLimit);

            this.#limitTimerIds.set(userId, timerId);
        };
    }

    static throttled(func: Function, userId: number, rateLimit = DEFAULT_RATE_LIMIT) {
        return async (...args: any) => {
            const cooldown = this.#cooldownTimerIds.get(userId);

            if (!cooldown) {
                await func(...args);

                const timerId = setTimeout(() => {
                    clearTimeout(cooldown);
                    this.#cooldownTimerIds.delete(userId);
                }, rateLimit);

                this.#cooldownTimerIds.set(userId, timerId);
            }
        };
    }
}
