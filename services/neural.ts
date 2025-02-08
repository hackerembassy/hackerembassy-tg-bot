import fs from "fs";

import config from "config";
import fetch from "node-fetch";
import openai from "openai";

import { ChatCompletionSystemMessageParam } from "openai/resources/chat/completions";

import { NeuralConfig } from "@config";
import { cosineSimilarity } from "@utils/math";

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

type embedding = {
    file: string;
    text: string;
    embedding: number[];
};

export class OpenAI {
    private client: openai;
    private embeddings: embedding[];

    constructor(apiKey: string) {
        this.client = new openai({
            apiKey,
        });
        const savedEmbeddings = fs.readFileSync("resources/embeddings.json", "utf-8");

        this.embeddings = JSON.parse(savedEmbeddings) as embedding[];
    }

    async getClosestEmbeddingTexts(text: string, count = 2) {
        const embedding = await this.generateEmbedding(text);

        const similarities = this.embeddings.map(e => ({
            file: e.file,
            text: e.text,
            similarity: cosineSimilarity(embedding, e.embedding),
        }));

        similarities.sort((a, b) => b.similarity - a.similarity);

        return similarities.slice(0, count).map(s => s.file + ": " + s.text);
    }

    async generateEmbedding(text: string) {
        const embedding = await this.client.embeddings.create({
            model: neuralConfig.openai.embeddings,
            dimensions: neuralConfig.openai.dimensions,
            input: text,
        });

        return embedding.data[0].embedding;
    }

    async askChat(prompt: string, ...contexts: string[]) {
        const systemContexts = contexts.map(context => ({
            role: "system",
            content: context,
        })) as ChatCompletionSystemMessageParam[];

        const response = await this.client.chat.completions.create(
            {
                model: neuralConfig.openai.model,
                messages: [
                    ...systemContexts,
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
            },
            {
                timeout: neuralConfig.openai.timeout,
            }
        );

        return response.choices[0].message.content;
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
