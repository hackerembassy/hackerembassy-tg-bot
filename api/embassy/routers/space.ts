import { Response, Router } from "express";
import config from "config";
import fetch from "node-fetch";

import { alarm, ringDoorbell, displayTextOnMatrix } from "@services/hass";
import logger from "@services/logger";
import DoorLock, { UnlockMethod } from "@services/door";

import { EmbassyApiConfig } from "@config";

import { createEncryptedAuthMiddleware } from "../middleware";

const embassyApiConfig = config.get<EmbassyApiConfig>("embassy-api");
const router = Router();

const encryptedAuthRequired = createEncryptedAuthMiddleware();

router.post("/unlock", encryptedAuthRequired, async (req: RequestWithBody<{ method?: "MQTT" | "HTTP" }>, res: Response) => {
    try {
        const method = req.body.method === "HTTP" ? UnlockMethod.HTTP : UnlockMethod.MQTT;
        const success = await DoorLock.unlock(method);

        if (!success) return res.status(500).send({ message: `Failed to unlock the door using ${method}` });

        return res.status(200).send({ message: `Door is unlocked using ${method}` });
    } catch (error) {
        return res.status(500).send({ error: "Failed to unlock the door" });
    }
});

router.post("/alarm", encryptedAuthRequired, async (req: RequestWithBody<{ state?: "disarm" }>, res: Response) => {
    try {
        if (req.body.state !== "disarm") return res.status(400).send("Unsupported alarm state");

        await alarm.disarm();
        logger.info(`Alarm is ${req.body.state}`);

        return res.sendStatus(200);
    } catch (error) {
        return res.status(500).send({ error: "Failed to change the alarm state" });
    }
});

/**
 * Endpoint to ring a doorbell
 */
router.get("/doorbell", async (req, res, next) => {
    try {
        const method = req.query.method;

        switch (method) {
            // Using doorbell esp32 Shelly api directly
            case "shelly":
                await fetch(`http://${embassyApiConfig.doorbell.host}/rpc/Switch.Set?id=0&on=true`);
                break;
            // Preferable method using hass
            case "hass":
            default:
                await ringDoorbell();
        }
        res.sendStatus(200);
    } catch (error) {
        next(error);
    }
});

router.post("/led-matrix", async (req: RequestWithBody<{ message?: string }>, res, next): Promise<any> => {
    try {
        if (!req.body.message) return res.sendStatus(400).send({ message: "Message is required" });

        await displayTextOnMatrix(req.body.message);

        res.sendStatus(200);
    } catch (error) {
        next(error);
    }
});

export default router;
