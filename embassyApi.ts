import { config as envconfig } from "dotenv";
envconfig();
import express from "express";
import cors from "cors";
import { json } from "body-parser";
import { default as fetch } from "node-fetch";
import { NodeSSH } from "node-ssh";
import find from "local-devices";
import { LUCI } from "luci-rpc";

import printer3d from "./services/printer3d";
import { getDoorcamImage, getWebcamImage, getWebcam2Image, sayInSpace, playInSpace, ringDoorbell } from "./services/media";
import logger from "./services/logger";
import { unlock } from "./services/mqtt";
import { decrypt } from "./utils/security";
import { createErrorMiddleware } from "./utils/middleware";
import config from "config";

const embassyApiConfig = config.get("embassy-api") as any;
const botConfig = config.get("bot") as any;
const port = embassyApiConfig.port;
const routerip = embassyApiConfig.routerip;
const wifiip = embassyApiConfig.wifiip;

process.env.TZ = botConfig.timezone;

import * as statusMonitor from "./services/statusMonitor";
import { getClimate } from "./services/home";
statusMonitor.startMonitoring();

const app = express();
app.use(cors());
app.use(json());
app.use(express.static(embassyApiConfig.static));
app.use(createErrorMiddleware(logger));

app.post("/sayinspace", async (req, res, next) => {
    try {
        await sayInSpace(req.body.text);
        res.send({ message: "Success" });
    } catch (error) {
        next(error);
    }
});

app.post("/playinspace", async (req, res, next) => {
    try {
        await playInSpace(req.body.link);
        res.send({ message: "Success" });
    } catch (error) {
        next(error);
    }
});

app.get("/statusmonitor", async (_, res, next) => {
    try {
        res.json(statusMonitor.readNewMessages());
    } catch (error) {
        next(error);
    }
});

app.get("/doorcam", async (_, res, next) => {
    try {
        res.send(await getDoorcamImage());
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

app.get("/webcam", async (_, res, next) => {
    try {
        res.send(await getWebcamImage());
    } catch (error) {
        next(error);
    }
});

app.get("/webcam2", async (_, res, next) => {
    try {
        res.send(await getWebcam2Image());
    } catch (error) {
        next(error);
    }
});

app.post("/unlock", async (req, res, next) => {
    try {
        const token = await decrypt(req.body.token);

        if (token === process.env["UNLOCKKEY"]) {
            unlock();
            logger.info("Door is opened");
            res.send("Success");
        } else res.sendStatus(401);
    } catch (error) {
        next(error);
    }
});

/**
 * Endpoint to get a list of devices by a full newtwork scan
 *
 * @deprecated Use Keenetic endpoint instead, this method is very unreliable (especialy for apple devices), only for temporary use.
 */
app.get("/devicesscan", async (_, res, next) => {
    try {
        const devices = await find({ address: embassyApiConfig.networkRange });
        res.send(devices.map(d => d.mac));
    } catch (error) {
        next(error);
    }
});

/**
 * Endpoint to ring a doorbell by calling Shelly
 *
 * @deprecated Use Keenetic endpoint instead, this method is very unreliable (especialy for apple devices), only for temporary use.
 */
app.get("/doorbellShelly", async (_, res, next) => {
    try {
        await fetch(`http://${embassyApiConfig.doorbell}/rpc/Switch.Set?id=0&on=true`);
        res.send({ message: "success" });
    } catch (error) {
        next(error);
    }
});

/**
 * Endpoint to ring a doorbell by calling Hass
 */
app.get("/doorbell", async (_, res, next) => {
    try {
        await ringDoorbell();
        res.send({ message: "Success" });
    } catch (error) {
        next(error);
    }
});

/**
 * Endpoint to get a list of devices inside from OpenWRT
 *
 * @deprecated Use Keenetic endpoint instead
 */
app.get("/devices", async (_, res, next) => {
    try {
        const luci = new LUCI(`https://${routerip}`, "bot", process.env["LUCITOKEN"]);
        await luci.init();
        luci.autoUpdateToken(1000 * 60 * 30);

        const rpc = [
            {
                jsonrpc: "2.0",
                id: 93,
                method: "call",
                params: [luci.token, "iwinfo", "assoclist", { device: "phy0-ap0" }],
            },
            {
                jsonrpc: "2.0",
                id: 94,
                method: "call",
                params: [luci.token, "iwinfo", "assoclist", { device: "phy1-ap0" }],
            },
        ];

        const response = await fetch(`http://${routerip}/ubus/`, {
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(rpc),
            method: "POST",
        });

        const adapters = await response.json();
        let macs = [];

        for (const wlanAdapter of adapters) {
            const devices = wlanAdapter.result[1]?.results;
            if (devices) macs = macs.concat(devices.map(dev => dev.mac.toLowerCase()));
        }

        res.send(macs);
    } catch (error) {
        next(error);
    }
});

app.get("/devicesFromKeenetic", async (_, res, next) => {
    try {
        const ssh = new NodeSSH();

        await ssh.connect({
            host: wifiip,
            username: process.env["WIFIUSER"],
            password: process.env["WIFIPASSWORD"],
        });

        const sshdata = await ssh.exec("show associations", [""]);
        const macs = [...sshdata.matchAll(/mac: ((?:[0-9A-Fa-f]{2}[:-]){5}(?:[0-9A-Fa-f]{2}))/gm)].map(item => item[1]);
        res.json(macs);
    } catch (error) {
        next(error);
    }
});

app.get("/printer", async (req, res, next) => {
    try {
        const printername = req.query.printername as string;

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

app.listen(port);

logger.info(`Embassy Api is started on port ${port}`);
