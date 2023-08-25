const botConfig = require("config").get("bot");

const RATE_LIMIT = botConfig.rateLimit ?? 500;

class RateLimiter {
    static #debounceTimerIds = new Map();
    static #limitTimerIds = new Map();
    static #cooldownTimerIds = new Map();

    /**
     * @param {Function} func
     * @param {any[]} args
     * @param {number} userId
     * @param {object} context
     */
    static debounce(func, args, userId, context) {
        clearTimeout(this.#debounceTimerIds.get(userId));

        const timerId = setTimeout(() => {
            func.apply(context, args);
            this.#debounceTimerIds.delete(userId);
        }, RATE_LIMIT);

        this.#debounceTimerIds.set(userId, timerId);
    }

    /**
     * @param {Function} func
     * @param {any[]} args
     * @param {number} userId
     * @param {object} context
     */
    static limit(func, args, userId, context) {
        const cooldown = this.#limitTimerIds.get(userId);
        if (!cooldown) func.apply(context, args);
        clearTimeout(cooldown);

        const timerId = setTimeout(() => {
            clearTimeout(cooldown);
            this.#limitTimerIds.delete(userId);
        }, RATE_LIMIT);

        this.#limitTimerIds.set(userId, timerId);
    }

    /**
     * @param {Function} func
     * @param {any[]} args
     * @param {number} userId
     * @param {object} context
     */
    static throttle(func, args, userId, context) {
        const cooldown = this.#cooldownTimerIds.get(userId);

        if (!cooldown) {
            func.apply(context, args);

            const timerId = setTimeout(() => {
                clearTimeout(cooldown);
                this.#cooldownTimerIds.delete(userId);
            }, RATE_LIMIT);

            this.#cooldownTimerIds.set(userId, timerId);
        }
    }
}

module.exports = RateLimiter;
