import request from "supertest";

import { displays } from "@services/embassy/hass";

import screenRouter from "@hackemapi/embassy/routers/screen";

import { appWith } from "../helpers";

jest.mock("@services/embassy/hass", () => ({
    __esModule: true,
    displays: { showPopup: jest.fn(), closePopup: jest.fn() },
}));

describe("Embassy HTTP API /screen router:", () => {
    const app = appWith(screenRouter, "/screen");

    afterEach(() => jest.clearAllMocks());

    test("/popup requires html content and forwards it to the display", async () => {
        const missingHtml = await request(app).post("/screen/popup").send({});

        (displays.showPopup as jest.Mock).mockImplementationOnce(async () => {});
        const success = await request(app).post("/screen/popup").send({ html: "<h1>hi</h1>" });

        expect(missingHtml.status).toBe(400);
        expect(success.status).toBe(200);
        expect(displays.showPopup).toHaveBeenCalledWith("<h1>hi</h1>");
    });

    test("/close_popup closes the popup", async () => {
        (displays.closePopup as jest.Mock).mockImplementationOnce(async () => {});

        const response = await request(app).post("/screen/close_popup").send();

        expect(response.status).toBe(200);
        expect(displays.closePopup).toHaveBeenCalled();
    });
});
