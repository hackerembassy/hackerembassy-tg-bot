import request from "supertest";

import { AvailablePrinters } from "@services/embassy/printer3d";

import printersRouter from "@hackemapi/embassy/routers/printers";

import { appWith } from "../helpers";

// Real Printer3d instances talk to printer hardware over HTTP.
jest.mock("@services/embassy/printer3d", () => ({
    __esModule: true,
    AvailablePrinters: new Map([
        [
            "anette",
            {
                getPrinterStatus: jest.fn(),
                getFileMetadata: jest.fn(),
                getCam: jest.fn(),
                getThumbnail: jest.fn(),
            },
        ],
    ]),
}));

describe("Embassy HTTP API /printers router:", () => {
    const app = appWith(printersRouter, "/printers");
    const mockPrinter = AvailablePrinters.get("anette") as unknown as {
        getPrinterStatus: jest.Mock;
        getFileMetadata: jest.Mock;
        getCam: jest.Mock;
        getThumbnail: jest.Mock;
    };

    afterEach(() => jest.clearAllMocks());

    test("404s for a printer that isn't configured", async () => {
        const response = await request(app).get("/printers/nonexistent");

        expect(response.status).toBe(404);
    });

    test("returns status, thumbnail, and cam for a configured printer", async () => {
        mockPrinter.getPrinterStatus.mockResolvedValueOnce({ status: { print_stats: { filename: "cube.gcode" } } });
        mockPrinter.getFileMetadata.mockResolvedValueOnce({ thumbnails: [] });
        mockPrinter.getCam.mockResolvedValueOnce(Buffer.from("cam-bytes"));

        const response = await request(app).get("/printers/anette");

        expect(response.status).toBe(200);
        expect((response.body as { status: { print_stats: { filename: string } } }).status.print_stats.filename).toBe(
            "cube.gcode"
        );
    });
});
