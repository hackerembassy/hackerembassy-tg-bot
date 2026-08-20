import request from "supertest";

import { wakeOnLan, pingHost, NeworkDevicesLocator } from "@utils/network";

import devicesRouter from "@hackemapi/embassy/routers/devices";

import { appWith } from "../helpers";

// devices.ts is unauthenticated (internal-network-only, see other embassy API notes) and talks to
// real hardware (wake-on-lan packets, ssh, network scans), so all of that is mocked out.
jest.mock("@utils/network", () => ({
    __esModule: true,
    wakeOnLan: jest.fn(),
    pingHost: jest.fn(),
    NeworkDevicesLocator: {
        getDevicesFromKeenetic: jest.fn(),
        getDevicesFromOpenWrt: jest.fn(),
        getDevicesFromUnifiController: jest.fn(),
    },
    arp: jest.fn(),
}));

const mockSSHExec = jest.fn();
const mockSSHConnect = jest.fn();
jest.mock("node-ssh", () => ({
    NodeSSH: jest.fn().mockImplementation(() => ({
        connect: mockSSHConnect,
        exec: mockSSHExec,
        dispose: jest.fn(),
    })),
}));

describe("Embassy HTTP API /devices router:", () => {
    const app = appWith(devicesRouter, "/devices");

    afterEach(() => jest.clearAllMocks());

    test("/:name/wake sends a magic packet for a configured device, 400 for an unknown one", async () => {
        const unknown = await request(app).post("/devices/nonexistent/wake").send();

        (wakeOnLan as jest.Mock).mockResolvedValueOnce(true);
        const success = await request(app).post("/devices/gaming/wake").send();

        expect(unknown.status).toBe(400);
        expect(success.status).toBe(200);
        expect(wakeOnLan).toHaveBeenCalledWith("70:85:C2:75:12:4C");
    });

    test("/:name/shutdown opens an ssh session and runs the shutdown command for a configured device", async () => {
        const unknown = await request(app).post("/devices/nonexistent/shutdown").send();

        mockSSHConnect.mockImplementationOnce(async () => {});
        mockSSHExec.mockImplementationOnce(async () => {});
        const success = await request(app).post("/devices/gaming/shutdown").send();

        expect(unknown.status).toBe(400);
        expect(success.status).toBe(200);
        expect(mockSSHConnect).toHaveBeenCalledWith(expect.objectContaining({ host: "newgayming.lan" }));
        expect(mockSSHExec).toHaveBeenCalledWith("shutdown now", [""]);
    });

    test("/:name/ping pings a configured device's host", async () => {
        (pingHost as jest.Mock).mockResolvedValueOnce({ alive: true });
        const response = await request(app).post("/devices/gaming/ping").send();

        expect(response.status).toBe(200);
        expect(pingHost).toHaveBeenCalledWith("newgayming.lan");
    });

    test("/inside fails safely rather than crashing when no wifi credentials are configured", async () => {
        // WIFIUSER/WIFIPASSWORD aren't set in the test environment, so the router's own guard
        // rejects before ever reaching NeworkDevicesLocator.
        const response = await request(app).get("/devices/inside");

        expect(response.status).toBe(500);
        expect(NeworkDevicesLocator.getDevicesFromKeenetic).not.toHaveBeenCalled();
    });
});
