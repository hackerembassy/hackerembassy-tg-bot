// The real embassy service talks to hackerspace hardware over HTTP. Left unmocked, any handler
// that touches it (e.g. /status querying climate, /addfund celebrating with the LED matrix/
// speaker) falls through jest-fetch-mock's telegram-only mock to a real network call, which is
// slow, environment-dependent, and can return garbage that fails JSON parsing.
//
// This has to stay a lazily-invoked factory (called from jest.mock's factory in jestSetup.ts)
// rather than doing the requireActual at module scope: eagerly importing the real module here
// pulls in its node-fetch dependency before Jest's transform pipeline is ready for it.
export function createEmbassyMock() {
    const actual = jest.requireActual<typeof import("@services/embassy/embassy")>("@services/embassy/embassy");

    return {
        ...actual,
        // jest.requireActual's __esModule flag is non-enumerable, so the spread above drops it.
        // Without it, TS's __importDefault interop helper double-wraps this whole object as
        // `default`, and every consumer's `import embassyService from ...` resolves to garbage.
        __esModule: true,
        default: {
            unlockDoorFor: jest.fn(),
            getAllCameras: jest.fn().mockResolvedValue([]),
            getPrinterStatus: jest.fn(),
            getSounds: jest.fn().mockResolvedValue([]),
            playSound: jest.fn(),
            getSpaceClimate: jest.fn().mockResolvedValue(null),
            getConditionerStatus: jest.fn(),
            pingDevice: jest.fn(),
            shutdownDevice: jest.fn(),
            ledMatrix: jest.fn(),
            clearScreen: jest.fn(),
            showScreen: jest.fn(),
            doorbell: jest.fn(),
            wakeDevice: jest.fn(),
            controlConditioner: jest.fn(),
            tts: jest.fn(),
            stopMedia: jest.fn(),
            getWebcamImage: jest.fn(),
            img2img: jest.fn(),
            txt2img: jest.fn(),
            ollama: jest.fn(),
            isAnyDeviceInside: jest.fn().mockResolvedValue(false),
            fetchMacsInside: jest.fn().mockResolvedValue([]),
        },
    };
}
