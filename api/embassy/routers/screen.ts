import { Router } from "express";

import { displays } from "@services/embassy/hass";

const router = Router();

router.post("/popup", async (req: RequestWithBody<{ html?: string }>, res, next): Promise<any> => {
    try {
        if (!req.body.html) return res.status(400).send({ message: "Html content is required" });

        await displays.showPopup(req.body.html);

        res.sendStatus(200);
    } catch (error) {
        next(error);
    }
});

router.post("/close_popup", async (_, res, next) => {
    try {
        await displays.closePopup();

        res.sendStatus(200);
    } catch (error) {
        next(error);
    }
});

export default router;
