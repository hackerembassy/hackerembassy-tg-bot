import { EventEmitter } from "node:events";

import logger from "./logger";

export const enum BroadcastEvents {
    SpaceOpened = "space-opened",
    SpaceClosed = "space-closed",
    SpaceUnlocked = "space-unlocked",
    DonationAdded = "donation-added",
    DonationChanged = "donation-changed",
    DonationRemoved = "donation-removed",
    HackemcoinsDonationRewarded = "hackemcoins-donation-rewarded",
}

type Listener = (...args: unknown[]) => unknown;

class Broadcast extends EventEmitter {
    addAsyncListener<T>(event: BroadcastEvents, listener: (payload: T) => Promise<unknown>): this {
        return this.addListener(event, listener as Listener);
    }

    // Waits for async listeners too; a failing listener is logged so it can't fail the emitting domain
    async emitAsync(event: BroadcastEvents, ...args: unknown[]): Promise<void> {
        const results = await Promise.allSettled(
            this.listeners(event).map(listener => Promise.resolve().then(() => (listener as Listener)(...args)))
        );

        for (const result of results) if (result.status === "rejected") logger.error(result.reason);
    }
}

const broadcast = new Broadcast();

export default broadcast;
