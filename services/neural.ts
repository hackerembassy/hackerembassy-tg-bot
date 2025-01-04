import config from "config";
import fetch, { Headers } from "node-fetch";

import { NeuralConfig } from "@config";
import { fetchWithTimeout } from "@utils/network";

const neuralConfig = config.get<NeuralConfig>("neural");

export enum AvailableModels {
    GPT,
    OLLAMA,
}

type txt2imgResponse = {
    images: string[];
    error?: string;
    detail?: string;
    parameters: any;
    info: string;
};

type ollamaGenerateResponse = {
    model: string;
    created_at: string;
    response: string;
    done: boolean;
    done_reason: string;
    error?: string;
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

    async askChat(prompt: string, context: string) {
        if (!this.apiKey) throw Error("OpenAI API key is not set");

        const myHeaders = new Headers();
        myHeaders.append("Content-Type", "application/json");
        myHeaders.append("Authorization", `Bearer ${this.apiKey}`);

        const raw = JSON.stringify({
            model: neuralConfig.openai.model,
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
            timeout: neuralConfig.openai.timeout,
        };

        const response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", requestOptions);

        if (!response.ok) {
            if (response.status >= 500) throw Error(`OpenAI is not avaiable: ${response.statusText}`);

            const errorBody = (await response.json()) as ApiErrorResponse;

            throw Error(`${errorBody.error.type} ${errorBody.error.message}`);
        }

        const body = (await response.json()) as ChatCompletionResponse;

        return body.choices[0].message.content;
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

    async img2image(image: string, prompt: string = "", negative_prompt: string = "") {
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

export class Ollama {
    public base: string;

    constructor() {
        this.base = neuralConfig.ollama.base;
    }

    static readonly defaultModel = neuralConfig.ollama.model;

    async generate(prompt: string, model: string = Ollama.defaultModel) {
        const raw = JSON.stringify({
            prompt,
            model: model,
            stream: false,
        });

        const requestOptions = {
            method: "POST",
            headers: {
                ["Content-Type"]: "application/json",
                ["accept"]: "application/json",
            },
            body: raw,
        };

        const response = await fetch(`${this.base}/api/generate`, requestOptions);
        const body = (await response.json()) as ollamaGenerateResponse;

        if (body.error) throw new Error(`${body.error}`);

        return body.response;
    }
}

export const ollama = new Ollama();
