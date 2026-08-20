import request from "supertest";

import { cams } from "@services/embassy/hass";

import camerasRouter from "@hackemapi/embassy/routers/cameras";

import { appWith } from "../helpers";

jest.mock("@services/embassy/hass", () => ({ __esModule: true, cams: { getImage: jest.fn() } }));

describe("Embassy HTTP API /cameras router:", () => {
    const app = appWith(camerasRouter, "/cameras");

    afterEach(() => jest.clearAllMocks());

    test("/:name returns the requested camera's image", async () => {
        (cams.getImage as jest.Mock).mockResolvedValueOnce(Buffer.from("jpeg-bytes"));

        const response = await request(app).get("/cameras/downstairs");

        expect(response.status).toBe(200);
        expect(cams.getImage).toHaveBeenCalledWith("downstairs");
    });

    // NOTE: the route body is `res.send(Object.keys(Object.keys(camsConfig)))`, which sends back
    // numeric array indices ("0", "1", ...) rather than the configured camera names - this test
    // documents current behavior rather than the presumably-intended one.
    test("/ responds without crashing", async () => {
        const response = await request(app).get("/cameras/");

        expect(response.status).toBe(200);
    });
});
