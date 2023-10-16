import swaggerAutogen from "swagger-autogen";

const doc = {
    info: {
        title: "Hacker Embassy API",
        description: "",
    },
    servers: [
        {
            url: "https://gateway.hackerembassy.site:9000/",
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
    },
};

const outputFile = "./swagger-schema.json";
const routes = ["./api/bot.ts"];

swaggerAutogen({ openapi: "3.0.0" })(outputFile, routes, doc);
