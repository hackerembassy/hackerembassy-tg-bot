import { promises as fs } from "fs";
import path from "path";

import config from "config";
import { Router } from "express";

import { EmbassyApiConfig } from "@config";
import { sayInSpace, playInSpace, stopMediaInSpace } from "@services/hass";

const embassyApiConfig = config.get<EmbassyApiConfig>("embassy-api");
const staticPath = path.join(__dirname, "../../..", embassyApiConfig.service.static);

const router = Router();

router.get("/sounds", async (_, res, next) => {
    try {
        const availableFiles = await fs.readdir(staticPath);

        res.send({
            sounds: availableFiles.filter(f => f.endsWith(".mp3")).map(filename => filename.replace(".mp3", "")),
        });
    } catch (error) {
        next(error);
    }
});

router.post("/tts", async (req: RequestWithBody<{ text?: string }>, res, next): Promise<any> => {
    try {
        if (!req.body.text) return res.status(400).send({ message: "Text is required" });

        await sayInSpace(req.body.text);

        res.sendStatus(200);
    } catch (error) {
        next(error);
    }
});

router.post("/play", async (req: RequestWithBody<{ link?: string }>, res, next): Promise<any> => {
    try {
        if (!req.body.link) return res.status(400).send({ message: "Link is required" });

        await playInSpace(req.body.link);

        res.sendStatus(200);
    } catch (error) {
        next(error);
    }
});

router.post("/stop", async (_, res, next) => {
    try {
        await stopMediaInSpace();

        res.sendStatus(200);
    } catch (error) {
        next(error);
    }
});

export default router;
