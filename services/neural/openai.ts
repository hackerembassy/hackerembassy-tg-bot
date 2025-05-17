import config from "config";
import { Headers } from "node-fetch";

import { NeuralConfig } from "@config";
import { fetchWithTimeout } from "@utils/network";

const neuralConfig = config.get<NeuralConfig>("neural");

type ApiErrorResponse = {
    error: {
        message: string;
        type: string;
    };
};

type ResponseChoice = {
    index: number;
    message: {
        role: string;
        content: string;
    };
    finish_reason: string;
    delta?: {
        role?: string;
        content?: string;
    };
};

export type ChatCompletionResponse = {
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

// Legacy non-streaming class to communicate with external OpenAI API
// TODO: Remove this class and route through Open Web UI
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
