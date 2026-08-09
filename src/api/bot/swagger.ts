import swaggerAutogen from "swagger-autogen";
import config from "config";

import { BotApiConfig } from "@config";

const apiConfig = config.get<BotApiConfig>("api");

const doc = {
    info: {
        title: "Hacker Embassy API",
        description: "",
    },
    servers: [
        {
            url: `${apiConfig.publicUrl}/`,
            description: "Gateway",
        },
        {
            url: `http://localhost:${apiConfig.port}/`,
            description: "Local server",
        },
    ],
    consumes: ["application/json"],
    definitions: {
        withHassToken: {
            token: "hass_token",
        },
        going: {
            $username: "rfoxed",
            $isgoing: true,
            message: "Приблизительно к 21:00",
            $token: "guest_token",
        },
        donation: {
            $userId: 10,
            $username: "rfoxed",
            $amount: 50,
            currency: "USD",
            postChatId: 123456789,
            accountant: "kitausername",
            $token: "terminal_token",
        },
    },
};

const outputFile = "./swagger-schema.json";
const routes = ["./src/api/bot/index.ts"];

void swaggerAutogen({ openapi: "3.0.0" })(outputFile, routes, doc);
