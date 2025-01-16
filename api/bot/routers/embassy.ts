import { Router } from "express";

import embassyService from "@services/embassy";

import { allowTrustedMembers, allowMembers } from "../middleware";

const embassyRouter = Router();

embassyRouter.post("/text", allowTrustedMembers, (req: RequestWithBody<{ text?: string }>, res) => {
    if (!req.body.text) return res.status(400).send("No text provided");

    return embassyService
        .ledMatrix(req.body.text)
        .then(() => res.sendStatus(200))
        .catch(() => res.sendStatus(500));
});

embassyRouter.post("/say", allowMembers, (req: RequestWithBody<{ text?: string }>, res) => {
    if (!req.body.text) return res.status(400).send("No text provided");

    return embassyService
        .tts(req.body.text)
        .then(() => res.sendStatus(200))
        .catch(() => res.sendStatus(500));
});

export default embassyRouter;
