import { Router } from "express";

import config from "config";

import { alarm, ringDoorbell, displayTextOnMatrix } from "@services/hass";
import logger from "@services/logger";
import { mqttSendOnce } from "@utils/network";
import { decrypt } from "@utils/security";

import { EmbassyApiConfig } from "@config";

const embassyApiConfig = config.get<EmbassyApiConfig>("embassy-api");
const router = Router();

router.post("/unlock", async (req: RequestWithBody<{ token?: string }>, res, next): Promise<any> => {
    try {
        if (!req.body.token) return res.sendStatus(400);
        const token = await decrypt(req.body.token);
        if (token !== process.env["UNLOCKKEY"]) return res.sendStatus(401).send({ message: "Invalid token" });

        alarm.disarm();
        mqttSendOnce(embassyApiConfig.mqtthost, "door", "1", process.env["MQTTUSER"], process.env["MQTTPASSWORD"]);
        logger.info("Door is opened");

        res.sendStatus(200);
    } catch (error) {
        next(error);
    }
});

router.post("/alarm", async (req: RequestWithBody<{ token?: string; state?: "disarm" }>, res, next): Promise<any> => {
    try {
        if (!req.body.token) return res.sendStatus(400);
        const token = await decrypt(req.body.token);
        if (token !== process.env["UNLOCKKEY"]) return res.sendStatus(401).send({ message: "Invalid token" });

        const alarmState = req.body.state as "disarm" | undefined;

        if (alarmState === "disarm") {
            alarm.disarm();
        } else {
            res.sendStatus(400);
            return;
        }

        logger.info(`Alarm is ${alarmState}`);

        res.sendStatus(200);
    } catch (error) {
        next(error);
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
