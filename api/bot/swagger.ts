import swaggerAutogen from "swagger-autogen";

const doc = {
    info: {
        title: "Hacker Embassy API",
        description: "",
    },
    servers: [
        {
            url: "https://gateway.hackem.cc:9000/",
            description: "Gateway",
        },
        {
            url: "http://localhost:3000/",
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
const routes = ["./api/bot/index.ts"];

swaggerAutogen({ openapi: "3.0.0" })(outputFile, routes, doc);
