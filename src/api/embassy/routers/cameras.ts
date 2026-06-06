import { Router } from "express";

import config from "config";

import { EmbassyApiConfig, CamConfig } from "@config";
import { cams } from "@services/embassy/hass";

const router = Router();

const camsConfig = config.get<EmbassyApiConfig>("embassy-api").cams;

router.get("/:name", async (req, res, next) => {
    try {
        res.send(await cams.getImage(req.params.name as keyof CamConfig));
    } catch (error) {
        next(error);
    }
});

router.get("/", (_, res, next) => {
    try {
        res.send(Object.keys(Object.keys(camsConfig)));
    } catch (error) {
        next(error);
    }
});

export default router;
