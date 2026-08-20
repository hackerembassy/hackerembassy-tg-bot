import request from "supertest";

import { speakers } from "@services/embassy/hass";

import speakerRouter from "@hackemapi/embassy/routers/speaker";

import { appWith } from "../helpers";

// The real speakers/Home Assistant client talks to hardware over HTTP; no auth middleware guards
// this router at all (see notes on the embassy API generally being internal-network-only).
jest.mock("@services/embassy/hass", () => ({
    __esModule: true,
    speakers: { say: jest.fn(), play: jest.fn(), stop: jest.fn() },
}));

describe("Embassy HTTP API /speaker router:", () => {
    const app = appWith(speakerRouter, "/speaker");

    afterEach(() => jest.clearAllMocks());

    test("/tts requires text and forwards it to the speakers", async () => {
        const missingText = await request(app).post("/speaker/tts").send({});

        (speakers.say as jest.Mock).mockImplementationOnce(async () => {});
        const success = await request(app).post("/speaker/tts").send({ text: "hello space" });

        expect(missingText.status).toBe(400);
        expect(success.status).toBe(200);
        expect(speakers.say).toHaveBeenCalledWith("hello space");
    });

    test("/play requires a link and forwards it to the speakers", async () => {
        const missingLink = await request(app).post("/speaker/play").send({});

        (speakers.play as jest.Mock).mockImplementationOnce(async () => {});
        const success = await request(app).post("/speaker/play").send({ link: "https://example.com/sound.mp3" });

        expect(missingLink.status).toBe(400);
        expect(success.status).toBe(200);
        expect(speakers.play).toHaveBeenCalledWith("https://example.com/sound.mp3");
    });

    test("/stop stops playback", async () => {
        (speakers.stop as jest.Mock).mockImplementationOnce(async () => {});
        const response = await request(app).post("/speaker/stop").send();

        expect(response.status).toBe(200);
        expect(speakers.stop).toHaveBeenCalled();
    });
});
