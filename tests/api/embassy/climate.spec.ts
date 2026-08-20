import request from "supertest";

import { sensors, AvailableConditioners } from "@services/embassy/hass";

import climateRouter from "@hackemapi/embassy/routers/climate";

import { appWith } from "../helpers";

// Real Conditioner/Sensors instances talk to Home Assistant over HTTP. Each power/mode/temperature
// change also does a real 5s sleep before re-checking state - fake that out so tests stay fast.
jest.mock("@services/embassy/hass", () => ({
    __esModule: true,
    sensors: { getClimate: jest.fn() },
    AvailableConditioners: new Map([
        [
            "private",
            {
                getState: jest.fn(),
                turnOn: jest.fn(),
                turnOff: jest.fn(),
                setMode: jest.fn(),
                setTemperature: jest.fn(),
                preheat: jest.fn(),
            },
        ],
    ]),
}));
jest.mock("@utils/common", () => ({
    ...jest.requireActual<typeof import("@utils/common")>("@utils/common"),
    sleep: jest.fn(async () => {}),
}));

describe("Embassy HTTP API /climate router:", () => {
    const app = appWith(climateRouter, "/climate");
    const conditioner = AvailableConditioners.get("private") as unknown as {
        getState: jest.Mock;
        turnOn: jest.Mock;
        turnOff: jest.Mock;
        setMode: jest.Mock;
        setTemperature: jest.Mock;
        preheat: jest.Mock;
    };

    afterEach(() => jest.clearAllMocks());

    test("/ returns the current climate sensor data", async () => {
        (sensors.getClimate as jest.Mock).mockResolvedValueOnce({ temperature: 21 });

        const response = await request(app).get("/climate/");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ temperature: 21 });
    });

    test("/conditioners/:name/state 404s for an unknown conditioner", async () => {
        const response = await request(app).get("/climate/conditioners/nonexistent/state");

        expect(response.status).toBe(404);
    });

    test("power/on and power/off toggle the conditioner and confirm the resulting state", async () => {
        conditioner.turnOn.mockImplementationOnce(async () => {});
        conditioner.getState.mockResolvedValueOnce({ state: "cool" });
        const on = await request(app).post("/climate/conditioners/private/power/on").send();

        conditioner.turnOff.mockImplementationOnce(async () => {});
        conditioner.getState.mockResolvedValueOnce({ state: "off" });
        const off = await request(app).post("/climate/conditioners/private/power/off").send();

        expect(on.status).toBe(200);
        expect(conditioner.turnOn).toHaveBeenCalled();
        expect(off.status).toBe(200);
        expect(conditioner.turnOff).toHaveBeenCalled();
    });

    test("/conditioners/:name/mode requires a mode and updates it", async () => {
        const missingMode = await request(app).post("/climate/conditioners/private/mode").send({});

        conditioner.setMode.mockImplementationOnce(async () => {});
        conditioner.getState.mockResolvedValueOnce({ state: "heat" });
        const success = await request(app).post("/climate/conditioners/private/mode").send({ mode: "heat" });

        expect(missingMode.status).toBe(404);
        expect(success.status).toBe(200);
        expect(conditioner.setMode).toHaveBeenCalledWith("heat");
    });

    test("/conditioners/:name/temperature accepts either an absolute temperature or a diff", async () => {
        const missingBoth = await request(app).post("/climate/conditioners/private/temperature").send({});

        conditioner.setTemperature.mockImplementationOnce(async () => {});
        conditioner.getState.mockResolvedValueOnce({ attributes: { temperature: 23 } });
        const absolute = await request(app).post("/climate/conditioners/private/temperature").send({ temperature: 23 });

        expect(missingBoth.status).toBe(404);
        expect(absolute.status).toBe(200);
        expect(conditioner.setTemperature).toHaveBeenCalledWith(23);
    });
});
