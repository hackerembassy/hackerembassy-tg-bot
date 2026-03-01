import { promises as fs } from "fs";
import path from "path";

import config from "config";
import { Router } from "express";

import { EmbassyApiConfig } from "@config";
import { speakers } from "@services/embassy/hass";

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

router.post("/tts", async (req: RequestWithBody<{ text?: string }>, res, next) => {
    try {
        if (!req.body.text) return res.status(400).send({ message: "Text is required" });

        await speakers.say(req.body.text);

        return res.sendStatus(200);
    } catch (error) {
        next(error);
        return;
    }
});

router.post("/play", async (req: RequestWithBody<{ link?: string }>, res, next) => {
    try {
        if (!req.body.link) return res.status(400).send({ message: "Link is required" });

        await speakers.play(req.body.link);

        return res.sendStatus(200);
    } catch (error) {
        next(error);
        return;
    }
});

router.post("/stop", async (_, res, next) => {
    try {
        await speakers.stop();

        res.sendStatus(200);
    } catch (error) {
        next(error);
    }
});

export default router;
