// TODO add type checking to request bodies and remove disables below
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import config from "config";
import cors from "cors";
import express from "express";
import { promises as fs } from "fs";
import { default as fetch } from "node-fetch";
import { NodeSSH } from "node-ssh";
import path from "path";

import { CamConfig, EmbassyApiConfig } from "../config/schema";
import {
    conditioner,
    getClimate,
    getWebcamImage,
    playInSpace,
    ringDoorbell,
    sayInSpace,
    stopMediaInSpace,
} from "../services/hass";
import logger from "../services/logger";
import { stableDiffusion } from "../services/neural";
import printer3d from "../services/printer3d";
import { sleep } from "../utils/common";
import { createErrorMiddleware } from "../utils/middleware";
import { mqttSendOnce, NeworkDevicesLocator, ping, wakeOnLan } from "../utils/network";
import { decrypt } from "../utils/security";

const embassyApiConfig = config.get<EmbassyApiConfig>("embassy-api");
const port = embassyApiConfig.service.port;

const app = express();
const staticPath = path.join(__dirname, "..", embassyApiConfig.service.static);
app.use(cors());
app.use(express.json());
app.use(express.static(staticPath));
app.use(createErrorMiddleware(logger));

app.get("/speaker/sounds", async (req, res, next) => {
    try {
        const availableFiles = await fs.readdir(staticPath);
        res.send({
            sounds: availableFiles.map(filename => filename.replace(".mp3", "")),
        });
    } catch (error) {
        next(error);
    }
});

app.post("/speaker/tts", async (req, res, next) => {
    try {
        await sayInSpace(req.body.text);
        res.send({ message: "Success" });
    } catch (error) {
        next(error);
    }
});

app.post("/speaker/play", async (req, res, next) => {
    try {
        await playInSpace(req.body.link);
        res.send({ message: "Success" });
    } catch (error) {
        next(error);
    }
});

app.post("/speaker/stop", async (_, res, next) => {
    try {
        await stopMediaInSpace();
        res.send({ message: "Success" });
    } catch (error) {
        next(error);
    }
});

app.get("/healthcheck", (_, res, next) => {
    try {
        res.sendStatus(200);
    } catch (error) {
        next(error);
    }
});

app.get("/climate", async (_, res, next) => {
    try {
        res.json(await getClimate());
    } catch (error) {
        next(error);
    }
});

app.get("/webcam/:name", async (req, res, next) => {
    try {
        res.send(await getWebcamImage(req.params.name as keyof CamConfig));
    } catch (error) {
        next(error);
    }
});

app.post("/device/:name/wake", async (req, res, next) => {
    try {
        const device = req.params.name;
        const mac = embassyApiConfig.devices[device]?.mac;

        if (mac && (await wakeOnLan(mac))) {
            logger.info(`Woke up ${mac}`);
            res.send({ message: "Magic packet sent" });
        } else res.sendStatus(400);
    } catch (error) {
        next(error);
    }
});

app.post("/device/:name/shutdown", async (req, res, next) => {
    try {
        const device = req.params.name;
        const host = embassyApiConfig.devices[device]?.host;

        if (!host) {
            res.sendStatus(400);
            return;
        }

        const os = embassyApiConfig.devices[device]?.os;
        const command = os === "windows" ? "shutdown /s" : "shutdown now";
        const ssh = new NodeSSH();
        await ssh.connect({
            host,
            username: process.env["GAMINGUSER"],
            password: process.env["GAMINGPASSWORD"],
        });
        await ssh.exec(command, [""]);
        ssh.dispose();

        res.sendStatus(200);
    } catch (error) {
        next(error);
    }
});

app.post("/device/:name/ping", async (req, res, next) => {
    try {
        const device = req.params.name;
        const host = embassyApiConfig.devices[device]?.host ?? device;

        if (host) {
            res.send(await ping(host));
        } else res.sendStatus(400);
    } catch (error) {
        next(error);
    }
});

app.post("/space/unlock", async (req, res, next) => {
    try {
        const token = await decrypt(req.body.token);

        if (token === process.env["UNLOCKKEY"]) {
            mqttSendOnce(embassyApiConfig.mqtthost, "door", "1", process.env["MQTTUSER"], process.env["MQTTPASSWORD"]);
            logger.info("Door is opened");
            res.send("Success");
        } else res.sendStatus(401);
    } catch (error) {
        next(error);
    }
});

/**
 * Endpoint to ring a doorbell
 */
app.get("/space/doorbell", async (req, res, next) => {
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
        res.send({ message: "Success" });
    } catch (error) {
        next(error);
    }
});

/**
 * Endpoint to get mac addresses of devices, which are currently connected to the space internal network
 * It's used for autoinside and unlock purposes
 */
app.get("/devices", async (req, res, next) => {
    try {
        const method = req.query.method;
        const luciToken = process.env["LUCITOKEN"];
        const wifiUser = process.env["WIFIUSER"];
        const wifiPassword = process.env["WIFIPASSWORD"];
        const unifiUser = process.env["UNIFIUSER"];
        const unifiPassword = process.env["UNIFIPASSWORD"];

        switch (method) {
            case "openwrt":
                if (!luciToken) throw Error("Missing Luci token");

                // We don't use our Xiaomi openWRT device as wifi access point anymore
                res.json(await NeworkDevicesLocator.getDevicesFromOpenWrt(embassyApiConfig.spacenetwork.routerip, luciToken));
                break;
            case "scan":
                // Use Keenetic method if possible, network scan is very unreliable (especialy for apple devices)
                res.json(await NeworkDevicesLocator.findDevicesUsingNmap(embassyApiConfig.spacenetwork.networkRange));
                break;
            case "unifi":
                // Use Keenetic method if possible, network scan is very unreliable (especialy for apple devices)
                if (!unifiUser || !unifiPassword) throw Error("Missing unifi credentials");

                res.json(
                    await NeworkDevicesLocator.getDevicesFromUnifiController(
                        embassyApiConfig.spacenetwork.unifihost,
                        unifiUser,
                        unifiPassword
                    )
                );
                break;
            // Our main wifi access point
            case "keenetic":
            default:
                if (!wifiUser || !wifiPassword) throw Error("Missing keenetic ssh credentials");

                res.json(
                    await NeworkDevicesLocator.getDevicesFromKeenetic(
                        embassyApiConfig.spacenetwork.wifiip,
                        wifiUser,
                        wifiPassword
                    )
                );
        }
    } catch (error) {
        next(error);
    }
});

/**
 * Endpoint to ask StableDiffusion to generate an image from a text prompt
 */
app.post("/sd/txt2img", async (req, res, next) => {
    try {
        const prompt = req.body?.prompt as string | undefined;
        const negative_prompt = req.body?.negative_prompt as string | undefined;

        if (!prompt) {
            res.sendStatus(400);
            return;
        }

        const image = await stableDiffusion.txt2image(prompt, negative_prompt);

        if (!image) throw Error("txt2image process failed");

        res.send({ image });
    } catch (error) {
        next(error);
    }
});

/**
 * Endpoint to ask StableDiffusion to generate an image from a text prompt and a starting image
 */
app.post("/sd/img2img", async (req, res, next) => {
    try {
        const prompt = (req.body?.prompt ?? "") as string;
        const negative_prompt = (req.body?.negative_prompt ?? "") as string;
        const initialImage = req.body?.image as string | undefined;

        if (!initialImage) {
            res.sendStatus(400);
            return;
        }

        const image = await stableDiffusion.img2image(prompt, negative_prompt, initialImage);

        if (!image) throw Error("img2image process failed");

        res.send({ image });
    } catch (error) {
        next(error);
    }
});

app.get("/printer/:name", async (req, res, next) => {
    try {
        const printername = req.params.name;

        if (!printername) {
            res.status(400).send({ message: "Printer name is required" });
            return;
        }

        let fileMetadata;
        let thumbnailBuffer;
        let cam;
        const statusResponse = await printer3d.getPrinterStatus(printername);
        const status = statusResponse?.result?.status;

        if (status) {
            const fileMetadataResponse = await printer3d.getFileMetadata(printername, status?.print_stats?.filename);
            try {
                cam = await printer3d.getCam(printername);
            } catch {
                cam = null;
            }

            if (fileMetadataResponse) {
                fileMetadata = fileMetadataResponse.result;
                const thumbnailPath = fileMetadata?.thumbnails[fileMetadata.thumbnails.length - 1]?.relative_path;
                thumbnailBuffer = await printer3d.getThumbnail(printername, thumbnailPath);
            }
        }

        res.send({ status, thumbnailBuffer, cam });
    } catch (error) {
        next(error);
    }
});

app.get("/conditioner/state", async (_, res, next) => {
    try {
        res.send(await conditioner.getState());
    } catch (error) {
        next(error);
    }
});

app.post("/conditioner/power/:action", async (req, res, next) => {
    try {
        const action = req.params.action;

        switch (action) {
            case "on":
                await conditioner.turnOn();
                break;
            case "off":
                await conditioner.turnOff();
                break;
            default:
                res.sendStatus(400);
                return;
        }

        await sleep(5000);

        const updatedState = await conditioner.getState();

        if ((action === "on" && updatedState.state !== "off") || (action === "off" && updatedState.state === "off")) {
            res.send({ message: "Success" });
            return;
        }
        throw new Error("State was not updated");
    } catch (error) {
        next(error);
    }
});

app.post("/conditioner/mode", async (req, res, next) => {
    try {
        await conditioner.setMode(req.body.mode);

        await sleep(5000);

        if ((await conditioner.getState()).state === req.body.mode) {
            res.send({ message: "Success" });
        }
        throw new Error("Mode was not updated");
    } catch (error) {
        next(error);
    }
});

app.post("/conditioner/temperature", async (req, res, next) => {
    try {
        const requestBody = req.body as { diff?: number; temperature?: number };

        let newTemperature = requestBody.temperature;

        if (requestBody.diff) {
            const initialState = await conditioner.getState();
            newTemperature = initialState.attributes.temperature + requestBody.diff;
        }

        if (newTemperature === undefined) {
            res.status(404).send({ message: "Provide either temperature or diff" });
            return;
        }

        await conditioner.setTemperature(newTemperature);
        await sleep(5000);

        const newState = await conditioner.getState();

        if (newState.attributes.temperature === newTemperature) {
            res.send({ message: "Success" });
        }
        throw new Error("Temperature was not updated");
    } catch (error) {
        next(error);
    }
});

export function StartEmbassyApi() {
    app.listen(port);
    logger.info(`Embassy Api is ready to accept requests on port ${port}`);
}
