import config from "config";

import { NeuralConfig } from "@config";
import { fetchWithTimeout } from "@utils/network";

const neuralConfig = config.get<NeuralConfig>("neural");

type txt2imgResponse = {
    images: string[];
    error?: string;
    detail?: string;
    parameters: any;
    info: string;
};

type ResponseChoice = {
    index: number;
    message: {
        role: string;
        content: string;
    };
    finish_reason: string;
};

type ChatCompletionResponse = {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: ResponseChoice[];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
};

type ApiErrorResponse = {
    error: {
        message: string;
        type: string;
    };
};

export class OpenAI {
    constructor(private apiKey: string) {}

    static defaultContext = "Ты телеграм бот хакерспейса, ты всегда отвечаешь кратко, смешно и иногда как гопник";

    async askChat(prompt: string, context: string = OpenAI.defaultContext) {
        if (!this.apiKey) throw Error("OpenAI API key is not set");

        const myHeaders = new Headers();
        myHeaders.append("Content-Type", "application/json");
        myHeaders.append("Authorization", `Bearer ${this.apiKey}`);

        const raw = JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: context,
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
        });

        const requestOptions = {
            method: "POST",
            headers: myHeaders,
            body: raw,
            timeout: 60000,
        };

        const response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", requestOptions);

        if (!response.ok) {
            if (response.status >= 500) throw Error(`OpenAI is not avaiable: ${response.statusText}`);

            const errorBody = (await response.json()) as ApiErrorResponse;

            throw Error(`${errorBody.error.type} ${errorBody.error.message}`);
        }

        const body = (await response.json()) as ChatCompletionResponse;

        return body.choices[0].message;
    }
}

export const openAI = new OpenAI(process.env["OPENAIAPIKEY"] ?? "");

class StableDiffusion {
    public base: string;
    public defaultSteps: number;
    public defaultSampler: string;
    public defaultDenoising: number;

    readonly nsfw = "((children))";

    constructor() {
        this.base = neuralConfig.stableDiffusion.base;
        this.defaultSteps = neuralConfig.stableDiffusion.steps ?? 18;
        this.defaultSampler = neuralConfig.stableDiffusion.sampler ?? "Euler a";
        this.defaultDenoising = neuralConfig.stableDiffusion.denoising ?? 0.57;
    }

    async img2image(prompt: string, negative_prompt: string = "", image: string) {
        const raw = JSON.stringify({
            prompt,
            negative_prompt: `${this.nsfw} ${negative_prompt}`,
            sampler_index: this.defaultSampler,
            steps: this.defaultSteps,
            denoising_strength: this.defaultDenoising,
            init_images: [image],
        });

        const requestOptions = {
            method: "POST",
            headers: {
                ["Content-Type"]: "application/json",
                ["accept"]: "application/json",
            },
            body: raw,
        };

        const response = await fetch(`${this.base}/sdapi/v1/img2img`, requestOptions);
        const body = (await response.json()) as txt2imgResponse;

        if (body.error) throw new Error(`${body.error}: ${body.detail}`);

        return body.images[0];
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
