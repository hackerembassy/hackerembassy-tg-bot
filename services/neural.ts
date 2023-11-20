import config from "config";

import { NeuralConfig } from "../config/schema";

const neuralConfig = config.get<NeuralConfig>("neural");

type txt2imgResponse = {
    images: string[];
    error?: string;
    detail?: string;
    parameters: any;
    info: string;
};

class StableDiffusion {
    public base: string;
    public defaultSteps: number;
    public defaultSampler: string;

    readonly nsfw = "((children))";

    constructor() {
        this.base = neuralConfig.stableDiffusion.base;
        this.defaultSteps = neuralConfig.stableDiffusion.steps ?? 15;
        this.defaultSampler = neuralConfig.stableDiffusion.sampler ?? "Euler a";
    }

    async txt2image(prompt: string, negative_prompt: string = "") {
        const raw = JSON.stringify({
            prompt,
            negative_prompt: `${this.nsfw} ${negative_prompt}`,
            sampler_index: this.defaultSampler,
            steps: this.defaultSteps,
        });

        const requestOptions = {
            method: "POST",
            headers: {
                ["Content-Type"]: "application/json",
                ["accept"]: "application/json",
            },
            body: raw,
        };

        const response = await fetch(`${this.base}/sdapi/v1/txt2img`, requestOptions);
        const body = (await response.json()) as txt2imgResponse;

        if (body.error) throw new Error(`${body.error}: ${body.detail}`);

        return body.images[0];
    }
}

export const stableDiffusion = new StableDiffusion();
