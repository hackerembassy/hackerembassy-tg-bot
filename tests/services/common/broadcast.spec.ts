import broadcast, { BroadcastEvents } from "@services/common/broadcast";
import logger from "@services/common/logger";

describe("broadcast.emitAsync", () => {
    const event = BroadcastEvents.SpaceUnlocked;

    afterEach(() => broadcast.removeAllListeners(event));

    test("resolves only after every async listener has finished", async () => {
        const finished: string[] = [];

        broadcast.addAsyncListener(event, async (payload: string) => {
            await new Promise(resolve => setTimeout(resolve, 5));
            finished.push(`slow ${payload}`);
        });
        broadcast.addListener(event, (payload: string) => finished.push(`sync ${payload}`));

        await broadcast.emitAsync(event, "door");

        expect(finished).toEqual(["sync door", "slow door"]);
    });

    test("logs a failing listener without rejecting or skipping the others", async () => {
        const delivered = jest.fn();

        broadcast.addAsyncListener(event, () => Promise.reject(new Error("Mocked async listener failure")));
        broadcast.addListener(event, () => {
            throw new Error("Mocked sync listener failure");
        });
        broadcast.addAsyncListener(event, () => {
            delivered();
            return Promise.resolve();
        });

        await expect(broadcast.emitAsync(event)).resolves.toBeUndefined();

        expect(delivered).toHaveBeenCalledTimes(1);
        expect(logger.error).toHaveBeenCalledWith(new Error("Mocked async listener failure"));
        expect(logger.error).toHaveBeenCalledWith(new Error("Mocked sync listener failure"));
    });
});
