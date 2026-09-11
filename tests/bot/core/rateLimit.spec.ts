import { executeOverTime, UserRateLimiter } from "@hackembot/core/classes/RateLimit";

describe("executeOverTime", () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it("runs calls sequentially, waiting rateLimit between each one", async () => {
        jest.useFakeTimers();
        const order: number[] = [];
        const calls = [1, 2, 3].map(n =>
            jest.fn(() => {
                order.push(n);
                return Promise.resolve(n * 10);
            })
        );

        const resultPromise = executeOverTime(calls, 500);

        await Promise.resolve();
        expect(order).toEqual([1]);
        expect(calls[1]).not.toHaveBeenCalled();

        await jest.advanceTimersByTimeAsync(500);
        expect(order).toEqual([1, 2]);
        expect(calls[2]).not.toHaveBeenCalled();

        await jest.advanceTimersByTimeAsync(500);
        expect(order).toEqual([1, 2, 3]);

        await jest.advanceTimersByTimeAsync(500);
        await expect(resultPromise).resolves.toEqual([10, 20, 30]);
    });

    it("propagates a rejection and stops without an onFailure handler", async () => {
        const calls = [
            jest.fn(() => Promise.resolve("ok")),
            jest.fn(() => Promise.reject<string>(new Error("boom"))),
            jest.fn(() => Promise.resolve("unreachable")),
        ];

        await expect(executeOverTime(calls, 0)).rejects.toThrow("boom");

        expect(calls[2]).not.toHaveBeenCalled();
    });

    it("uses onFailure to recover from a rejection and continues with the remaining calls", async () => {
        const calls = [
            jest.fn(() => Promise.resolve("first")),
            jest.fn(() => Promise.reject<string>(new Error("boom"))),
            jest.fn(() => Promise.resolve("third")),
        ];
        const onFailure = jest.fn((error: unknown) => `recovered: ${(error as Error).message}`);

        const results = await executeOverTime(calls, 0, onFailure);

        expect(results).toEqual(["first", "recovered: boom", "third"]);
        expect(onFailure).toHaveBeenCalledWith(expect.any(Error));
    });
});

describe("UserRateLimiter.throttled", () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it("invokes the wrapped function on the first call", async () => {
        jest.useFakeTimers();
        const fn = jest.fn();
        const wrapped = UserRateLimiter.throttled(fn, 101, 1000);

        await wrapped("a");

        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith("a");
    });

    it("drops calls for the same user within the cooldown window, then allows one after it elapses", async () => {
        jest.useFakeTimers();
        const fn = jest.fn();
        const wrapped = UserRateLimiter.throttled(fn, 102, 1000);

        await wrapped("a");
        await wrapped("b");
        expect(fn).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(1000);
        await wrapped("c");

        expect(fn).toHaveBeenCalledTimes(2);
        expect(fn).toHaveBeenLastCalledWith("c");
    });

    it("throttles each user independently", async () => {
        jest.useFakeTimers();
        const fn = jest.fn();
        const wrappedA = UserRateLimiter.throttled(fn, 201, 1000);
        const wrappedB = UserRateLimiter.throttled(fn, 202, 1000);

        await wrappedA("from A");
        await wrappedB("from B");

        expect(fn).toHaveBeenCalledTimes(2);
    });
});
