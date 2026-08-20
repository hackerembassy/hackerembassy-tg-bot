import request from "supertest";

import { openwebui } from "@services/neural/openwebui";
import { stableDiffusion } from "@services/neural/stablediffusion";

import neuralRouter from "@hackemapi/embassy/routers/neural";

import { appWith } from "../helpers";

jest.mock("@services/neural/openwebui", () => ({ __esModule: true, openwebui: { generateOllama: jest.fn() } }));
jest.mock("@services/neural/stablediffusion", () => ({
    __esModule: true,
    stableDiffusion: { txt2image: jest.fn(), img2image: jest.fn() },
}));

describe("Embassy HTTP API /neural router:", () => {
    const app = appWith(neuralRouter, "/neural");

    afterEach(() => jest.clearAllMocks());

    test("/ollama/generate requires a prompt and returns the generated text", async () => {
        const missingPrompt = await request(app).post("/neural/ollama/generate").send({});

        (openwebui.generateOllama as jest.Mock).mockResolvedValueOnce("42");
        const success = await request(app).post("/neural/ollama/generate").send({ prompt: "what is the answer" });

        expect(missingPrompt.status).toBe(400);
        expect(success.status).toBe(200);
        expect(success.body).toEqual({ response: "42" });
    });

    test("/sd/txt2img requires a prompt and returns the generated image", async () => {
        const missingPrompt = await request(app).post("/neural/sd/txt2img").send({});

        (stableDiffusion.txt2image as jest.Mock).mockResolvedValueOnce("base64-image-data");
        const success = await request(app).post("/neural/sd/txt2img").send({ prompt: "a cat" });

        expect(missingPrompt.status).toBe(400);
        expect(success.status).toBe(200);
        expect(success.body).toEqual({ image: "base64-image-data" });
    });

    test("/sd/img2img requires an initial image", async () => {
        const missingImage = await request(app).post("/neural/sd/img2img").send({ prompt: "a cat" });

        (stableDiffusion.img2image as jest.Mock).mockResolvedValueOnce("base64-image-data");
        const success = await request(app).post("/neural/sd/img2img").send({ image: "base64-source" });

        expect(missingImage.status).toBe(400);
        expect(success.status).toBe(200);
    });
});
