import { Response, Router } from "express";

import { alarm, displays } from "@services/embassy/hass";
import logger from "@services/common/logger";
import DoorLock, { UnlockMethod } from "@services/embassy/door";

import { createEncryptedAuthMiddleware } from "../middleware";

const router = Router();

const encryptedAuthRequired = createEncryptedAuthMiddleware();

router.post("/unlock", encryptedAuthRequired, async (req: RequestWithBody<{ method?: "MQTT" | "HTTP" }>, res: Response) => {
    try {
        const method = req.body.method === "HTTP" ? UnlockMethod.HTTP : UnlockMethod.MQTT;
        const success = await DoorLock.unlock(method);

        if (!success) return void res.status(500).send({ message: `Failed to unlock the door using ${method}` });

        res.status(200).send({ message: `Door is unlocked using ${method}` });
    } catch {
        res.status(500).send({ error: "Failed to unlock the door" });
    }
});

router.post("/alarm", encryptedAuthRequired, async (req: RequestWithBody<{ state?: "disarm" }>, res: Response) => {
    try {
        if (req.body.state !== "disarm") return void res.status(400).send("Unsupported alarm state");

        await alarm.disarm();
        logger.info(`Alarm is ${req.body.state}`);

        res.sendStatus(200);
    } catch {
        res.status(500).send({ error: "Failed to change the alarm state" });
    }
});

router.post("/led-matrix", async (req: RequestWithBody<{ message?: string }>, res, next): Promise<any> => {
    try {
        if (!req.body.message) return res.sendStatus(400).send({ message: "Message is required" });

        await displays.showOnMatrix(req.body.message);

        res.sendStatus(200);
    } catch (error) {
        next(error);
    }
});

export default router;
