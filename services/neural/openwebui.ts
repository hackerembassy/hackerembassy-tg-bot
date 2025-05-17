import { Transform } from "stream";

import config from "config";
import fetch from "node-fetch";
import split2 from "split2";

import { NeuralConfig } from "@config";

import { ChatCompletionResponse } from "./openai";

const neuralConfig = config.get<NeuralConfig>("neural");

type ollamaGenerateResponse = {
    model: string;
    created_at: string;
    response: string;
    done: boolean;
    done_reason: string;
    error?: string;
};

type ollamaModel = {
    id: string;
    name: string;
    object: string;
    created: number;
    owned_by: string;
};

type ollamaModelsResponse = {
    data: ollamaModel[];
};

// Transforms
const OPENAI_LINE_PREFIX = "data: ";
const OPEN_AI_DONE_MARK = "[DONE]";
const OPEN_AI_NOT_FOUND = '{"detail":"Model not found"}';

export type DeltaStream = AsyncIterable<DeltaObject>;

export type DeltaObject = {
    response: string | null;
    done: boolean;
};

//{"selected_model_id": "gemma3:4b-it-qat"}
export type SelectedModelResponse = {
    selected_model_id: string;
};

//{"detail":"'content'"}
export type OllamaErrorResponse = {
    detail: string;
};

function wrapOpenAiChunk() {
    return new Transform({
        readableObjectMode: true,
        writableObjectMode: true,
        transform(line: string, encoding, callback) {
            line = line.trim();
            if (!line) return callback();

            if (line.startsWith(OPENAI_LINE_PREFIX)) {
                const trimmedLine = line.slice(OPENAI_LINE_PREFIX.length).trim();
                const parsedLine = JSON.parse(trimmedLine) as
                    | ChatCompletionResponse
                    | SelectedModelResponse
                    | OllamaErrorResponse;

                if ("selected_model_id" in parsedLine) return callback();
                if ("detail" in parsedLine) {
                    this.push({ response: parsedLine.detail, done: true });
                    return void this.push(null);
                }

                const content = parsedLine.choices[0].delta?.content;

                if (!content) {
                    this.push({ response: null, done: true });
                    return void this.push(null);
                } else {
                    this.push({ response: content, done: false });
                }
            } else if (line === OPEN_AI_DONE_MARK) {
                this.push({ response: null, done: true });
                return void this.push(null);
            } else if (line === OPEN_AI_NOT_FOUND) {
                this.push({ response: "Model not found", done: true });
                return void this.push(null);
            }
            callback();
        },
    });
}

function wrapOllamaChunk() {
    return new Transform({
        readableObjectMode: true,
        writableObjectMode: true,
        transform(line: string, encoding, callback) {
            this.push(JSON.parse(line.trim()));
            callback();
        },
    });
}

export class OpenWebUI {
    public base: string;

    constructor(private apiKey: string) {
        this.base = neuralConfig.openwebui.base;
    }

    static readonly defaultModel = neuralConfig.openwebui.model;

    private async generateOllamaBase(
        prompt: string,
        model: string = OpenWebUI.defaultModel,
        systemPrompt?: string,
        stream: boolean = false
    ) {
        const raw = JSON.stringify({
            prompt,
            model: model,
            system: systemPrompt,
            stream,
        });
        const requestOptions = {
            method: "POST",
            headers: {
                ["Content-Type"]: "application/json",
                ["accept"]: "application/json",
                ["Authorization"]: this.apiKey.length > 0 ? `Bearer ${this.apiKey}` : "",
            },
            body: raw,
        };

        const response = await fetch(`${this.base}/ollama/api/generate`, requestOptions);

        if (!response.ok) throw new Error(`Ollama is not available: ${response.statusText}`);

        return response;
    }
    async generateOllama(prompt: string, model: string = OpenWebUI.defaultModel, systemPrompt?: string) {
        const response = await this.generateOllamaBase(prompt, model, systemPrompt);

        const body = (await response.json()) as ollamaGenerateResponse;

        if (body.error) throw new Error(`${body.error}`);

        return body.response;
    }

    async generateOllamaStream(prompt: string, model: string = OpenWebUI.defaultModel, systemPrompt?: string) {
        const response = await this.generateOllamaBase(prompt, model, systemPrompt, true);

        if (!response.body) throw new Error("Ollama: No stream body");

        return response.body.pipe(split2()).pipe(wrapOllamaChunk()) as DeltaStream;
    }

    async generateOpenAiStream(prompt: string, model: string = OpenWebUI.defaultModel) {
        const headers = {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
        };
        const data = {
            model: model,
            messages: [{ role: "user", content: prompt }],
            stream: true,
        };

        const response = await fetch(`${this.base}/api/chat/completions`, {
            method: "POST",
            headers,
            body: JSON.stringify(data),
        });

        if (!response.body) {
            throw new Error("Streaming not supported: no response body.");
        }

        return response.body.pipe(split2()).pipe(wrapOpenAiChunk()) as DeltaStream;
    }

    async getModels() {
        const origin = new URL(this.base).origin;
        const response = await fetch(`${origin}/api/models`, {
            method: "GET",
            headers: {
                ["Content-Type"]: "application/json",
                ["accept"]: "application/json",
                ["Authorization"]: this.apiKey.length > 0 ? `Bearer ${this.apiKey}` : "",
            },
        });

        if (!response.ok) throw new Error(`Ollama is not available: ${response.statusText}`);

        const body = (await response.json()) as ollamaModelsResponse;

        return body.data.map(model => model.id);
    }
}

export const openwebui = new OpenWebUI(process.env["OLLAMAAPIKEY"] ?? "");
