/* eslint-disable @typescript-eslint/ban-types */
import config from "config";
const botConfig = config.get("bot") as any;
const RATE_LIMIT = botConfig.rateLimit ?? 500;

export default class RateLimiter {
    static #debounceTimerIds = new Map();
    static #limitTimerIds = new Map();
    static #cooldownTimerIds = new Map();

    static debounce(func: Function, args: any[], userId: number, context: object) {
        clearTimeout(this.#debounceTimerIds.get(userId));

        const timerId = setTimeout(() => {
            func.apply(context, args);
            this.#debounceTimerIds.delete(userId);
        }, RATE_LIMIT);

        this.#debounceTimerIds.set(userId, timerId);
    }

    static limit(func: Function, args: any[], userId: number, context: object) {
        const cooldown = this.#limitTimerIds.get(userId);
        if (!cooldown) func.apply(context, args);
        clearTimeout(cooldown);

        const timerId = setTimeout(() => {
            clearTimeout(cooldown);
            this.#limitTimerIds.delete(userId);
        }, RATE_LIMIT);

        this.#limitTimerIds.set(userId, timerId);
    }

    static async throttle(func: Function, args: any[], userId: number, context: object) {
        const cooldown = this.#cooldownTimerIds.get(userId);

        if (!cooldown) {
            await func.apply(context, args);

            const timerId = setTimeout(() => {
                clearTimeout(cooldown);
                this.#cooldownTimerIds.delete(userId);
            }, RATE_LIMIT);

            this.#cooldownTimerIds.set(userId, timerId);
        }
    }
}
