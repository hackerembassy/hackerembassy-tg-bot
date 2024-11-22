import path from "path";

import config from "config";
import cors from "cors";
import express from "express";

import { EmbassyApiConfig } from "@config";
import logger from "@services/logger";
import { catErrorPage } from "@utils/meme";
import { createDebugMiddleware, createErrorMiddleware } from "@utils/middleware";

import spaceRouter from "./routers/space";
import speakerRouter from "./routers/speaker";
import neuralRouter from "./routers/neural";
import devicesRouter from "./routers/devices";
import printersRouter from "./routers/printers";
import climateRouter from "./routers/climate";
import camerasRouter from "./routers/cameras";
import screenRouter from "./routers/screen";

const embassyApiConfig = config.get<EmbassyApiConfig>("embassy-api");
const port = embassyApiConfig.service.port;
const app = express();
const staticPath = path.join(__dirname, "../..", embassyApiConfig.service.static);

if (process.env["BOTDEBUG"] === "true") app.use(createDebugMiddleware());
app.use(cors());
app.use(express.json());
app.use(express.static(staticPath));
app.use(createErrorMiddleware(logger));

app.use("/space", spaceRouter);
app.use("/speaker", speakerRouter);
app.use("/neural", neuralRouter);
app.use("/devices", devicesRouter);
app.use("/printers", printersRouter);
app.use("/climate", climateRouter);
app.use("/cameras", camerasRouter);
app.use("/screen", screenRouter);

app.get("/healthcheck", (_, res, next) => {
    try {
        res.sendStatus(200);
    } catch (error) {
        next(error);
    }
});

app.get("*", (_, res) => {
    res.status(404).send(catErrorPage(404));
});

export function StartEmbassyApi() {
    app.listen(port);
    logger.info(`Embassy Api is ready to accept requests on port ${port}`);
}
