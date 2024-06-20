import { Router } from "express";

import { getClimate, ConditionerMode, AvailableConditioners } from "@services/hass";
import { sleep } from "@utils/common";

const router = Router();

router.get("/", async (_, res, next) => {
    try {
        res.json(await getClimate());
    } catch (error) {
        next(error);
    }
});

router.get("/conditioners/:name/state", async (req, res, next) => {
    try {
        const conditioner = AvailableConditioners.get(req.params.name);

        if (!conditioner) {
            res.status(404).send({ message: "Conditioner not found" });
            return;
        }

        res.send(await conditioner.getState());
    } catch (error) {
        next(error);
    }
});

router.post("/conditioners/:name/power/:action", async (req, res, next): Promise<any> => {
    try {
        const conditioner = AvailableConditioners.get(req.params.name);

        if (!conditioner) return res.status(404).send({ message: "Conditioner not found" });

        const action = req.params.action;

        switch (action) {
            case "on":
                await conditioner.turnOn();
                break;
            case "off":
                await conditioner.turnOff();
                break;
            default:
                res.sendStatus(400).send({ message: "Invalid action, use 'on' or 'off'" });
                return;
        }

        await sleep(5000);

        const updatedState = await conditioner.getState();
        const wasStateUpdated =
            (action === "on" && updatedState.state !== "off") || (action === "off" && updatedState.state === "off");

        if (!wasStateUpdated) throw new Error("State was not updated");

        res.sendStatus(200);
    } catch (error) {
        next(error);
    }
});

router.post("/conditioners/:name/mode", async (req: RequestWithBody<{ mode?: ConditionerMode }>, res, next): Promise<any> => {
    try {
        const conditioner = AvailableConditioners.get(req.params.name);
        const requestBody = req.body;
        const mode = requestBody.mode;

        if (!conditioner) return res.status(404).send({ message: "Conditioner not found" });
        if (!mode) return res.status(404).send({ message: "Provide mode" });

        await conditioner.setMode(mode);
        await sleep(5000);

        const updatedState = await conditioner.getState();
        if (updatedState.state !== mode) throw new Error("Mode was not updated");

        res.sendStatus(200);
    } catch (error) {
        next(error);
    }
});

router.post("/conditioners/:name/preheat", async (req, res, next): Promise<any> => {
    try {
        const conditioner = AvailableConditioners.get(req.params.name);

        if (!conditioner) return res.status(404).send({ message: "Conditioner not found" });

        const response = await conditioner.preheat();

        if (response.status !== 200) throw new Error("Preheat failed");

        res.sendStatus(200);
    } catch (error) {
        next(error);
    }
});

router.post("/conditioners/:name/temperature", async (req, res, next): Promise<any> => {
    try {
        const conditioner = AvailableConditioners.get(req.params.name);
        const requestBody = req.body as { diff?: number; temperature?: number } | undefined;

        if (!conditioner) return res.status(404).send({ message: "Conditioner not found" });
        if (!requestBody || !(requestBody.diff || requestBody.temperature))
            return res.status(404).send({ message: "Provide either temperature or diff" });

        const newTemperature = requestBody.diff
            ? (await conditioner.getState()).attributes.temperature + requestBody.diff
            : (requestBody.temperature as number);

        await conditioner.setTemperature(newTemperature);
        await sleep(5000);

        const newState = await conditioner.getState();

        if (newState.attributes.temperature !== newTemperature) throw new Error("Temperature was not updated");

        res.sendStatus(200);
    } catch (error) {
        next(error);
    }
});

export default router;
