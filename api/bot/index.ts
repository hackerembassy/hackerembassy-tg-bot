import fs from "fs";
import path from "path";

import config from "config";
import cors from "cors";
import express from "express";
import swaggerUi from "swagger-ui-express";
import prometheus from "express-prometheus-middleware";

import bot from "@hackembot/instance";

import { BotApiConfig } from "@config";
import logger from "@services/logger";
import { catErrorPage } from "@utils/meme";
import { createErrorMiddleware } from "@utils/express";

import apiRouter from "./routers/api";
import textRouter from "./routers/text";

const apiConfig = config.get<BotApiConfig>("api");
const app = express();
const port = apiConfig.port;

app.use(cors());
app.use(express.json());
app.use("/static", express.static(path.join(__dirname, "../..", apiConfig.static)));
app.use(createErrorMiddleware(logger));

// Add Swagger if exists
try {
    const swaggerFile = fs.readFileSync(path.resolve(__dirname, "swagger-schema.json"));
    const swaggerDocument = JSON.parse(swaggerFile.toString()) as swaggerUi.JsonObject;
    app.use("/swagger", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch (error) {
    logger.error(error);
}

// Expose Prometheus metrics
app.use(
    (prometheus as AnyFunction)({
        metricsPath: "/metrics",
        collectDefaultMetrics: true,
        requestDurationBuckets: [0.1, 0.5, 1, 1.5],
        requestLengthBuckets: [512, 1024, 5120, 10240, 51200, 102400],
        responseLengthBuckets: [512, 1024, 5120, 10240, 51200, 102400],
    })
);

// Routes
app.use("/text", textRouter);
app.use("/api", apiRouter);

app.get("/healthcheck", (_, res, next) => {
    try {
        if (bot.pollingError) {
            res.status(500).send({ error: "Polling error" });
        } else res.sendStatus(200);
    } catch (error) {
        next(error);
    }
});

app.get("*", (_, res) => {
    res.status(404).send(catErrorPage(404));
});

export function StartSpaceApi() {
    app.listen(port);
    logger.info(`Bot Api is ready to accept requests on port ${port}`);
}
