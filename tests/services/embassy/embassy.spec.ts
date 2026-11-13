import type { PrinterStatusResult } from "@services/embassy/printer3d";

// jestSetup mocks the embassy service for everyone else, here we test the real one
const { default: embassyService, EMBASSY_CACHE_TIME } =
    jest.requireActual<typeof import("@services/embassy/embassy")>("@services/embassy/embassy");

const floor = { temperature: "23", humidity: "40" };

// memoizee arms its expiry timer one setImmediate after the promise settles
const flush = () => new Promise(resolve => setImmediate(resolve));
const expireCache = async () => {
    await flush();
    jest.advanceTimersByTime(EMBASSY_CACHE_TIME + 1);
};
const printingStatus = {
    status: {
        print_stats: { state: "printing", filename: "benchy.gcode", total_duration: 600.4, filament_used: 1 },
        display_status: { progress: 0.675 },
        extruder: { temperature: 210, targer: 210 },
        heater_bed: { temperature: 60, targer: 60 },
    },
    thumbnailBuffer: null,
    cam: null,
} as PrinterStatusResult;

describe("EmbassyService cached hardware reads", () => {
    // memoizee settles promises via nextTick/setImmediate, those must stay real
    beforeEach(() =>
        jest.useFakeTimers({
            doNotFake: ["nextTick", "setImmediate", "clearImmediate", "queueMicrotask", "performance", "hrtime"],
        })
    );
    afterEach(async () => {
        // Expire the cache while its timers are still fake, so the next test starts clean
        await expireCache();
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    test("climate is queried at most once per cache window, concurrent callers share one request", async () => {
        const climate = { firstFloor: floor, secondFloor: floor, bedroom: floor };
        const spy = jest.spyOn(embassyService, "getSpaceClimate").mockResolvedValue(climate);

        const results = await Promise.all([embassyService.getSpaceClimateCached(), embassyService.getSpaceClimateCached()]);
        await embassyService.getSpaceClimateCached();

        expect(results).toEqual([climate, climate]);
        expect(spy).toHaveBeenCalledTimes(1);

        await expireCache();
        await embassyService.getSpaceClimateCached();
        expect(spy).toHaveBeenCalledTimes(2);
    });

    test("climate failures resolve to null and are cached too", async () => {
        const spy = jest.spyOn(embassyService, "getSpaceClimate").mockRejectedValue(new Error("timeout"));

        expect(await embassyService.getSpaceClimateCached()).toBeNull();
        expect(await embassyService.getSpaceClimateCached()).toBeNull();
        expect(spy).toHaveBeenCalledTimes(1);
    });

    test("printers summary maps status, marks unreachable printers offline and is cached", async () => {
        const spy = jest
            .spyOn(embassyService, "getPrinterStatus")
            .mockImplementation(name =>
                name === "anette" ? Promise.resolve(printingStatus) : Promise.reject(new Error("offline"))
            );

        const summary = await embassyService.getPrintersSummaryCached();

        expect(summary.find(p => p.name === "anette")).toEqual({
            name: "anette",
            state: "printing",
            filename: "benchy.gcode",
            progress: 68,
            printDuration: 600,
            extruderTemperature: 210,
            bedTemperature: 60,
        });
        expect(summary.filter(p => p.name !== "anette").every(p => p.state === "offline")).toBe(true);

        const callsAfterFirst = spy.mock.calls.length;
        await embassyService.getPrintersSummaryCached();
        expect(spy).toHaveBeenCalledTimes(callsAfterFirst);

        await expireCache();
        await embassyService.getPrintersSummaryCached();
        expect(spy).toHaveBeenCalledTimes(callsAfterFirst * 2);
    });
});
