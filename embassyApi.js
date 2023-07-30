require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { default: fetch } = require("node-fetch");
const { NodeSSH } = require("node-ssh");
const find = require("local-devices");
const { LUCI } = require("luci-rpc");

const printer3d = require("./services/printer3d");
const { getDoorcamImage, getWebcamImage, getWebcam2Image, sayInSpace, playInSpace, ringDoorbell } = require("./services/media");
const logger = require("./services/logger");
const { unlock } = require("./services/mqtt");
const { decrypt } = require("./utils/security");
const { createErrorMiddleware } = require("./utils/middleware");

const config = require("config");
const embassyApiConfig = config.get("embassy-api");
const botConfig = config.get("bot");
const port = embassyApiConfig.port;
const routerip = embassyApiConfig.routerip;
const wifiip = embassyApiConfig.wifiip;

process.env.TZ = botConfig.timezone;

const statusMonitor = require("./services/statusMonitor");
statusMonitor.startMonitoring();

const app = express();
app.use(cors());
app.use(bodyParser.json());
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

        let rpc = [
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

        let response = await fetch(`http://${routerip}/ubus/`, {
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(rpc),
            method: "POST",
        });

        let adapters = await response.json();
        let macs = [];

        for (const wlanAdapter of adapters) {
            let devices = wlanAdapter.result[1]?.results;
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

        let sshdata = await ssh.exec("show associations", [""]);
        let macs = [...sshdata.matchAll(/mac: ((?:[0-9A-Fa-f]{2}[:-]){5}(?:[0-9A-Fa-f]{2}))/gm)].map(item => item[1]);
        res.json(macs);
    } catch (error) {
        next(error);
    }
});

app.get("/printer", async (req, res, next) => {
    try {
        let printername = req.query.printername;

        if (!printername) {
            res.status(400).send({ message: "Printer name is required" });
            return;
        }

        let fileMetadata;
        let thumbnailBuffer;
        let cam;
        let statusResponse = await printer3d.getPrinterStatus(printername);
        let status = statusResponse?.result?.status;

        if (status) {
            let fileMetadataResponse = await printer3d.getFileMetadata(printername, status?.print_stats?.filename);
            try {
                cam = await printer3d.getCam(printername);
            } catch {
                cam = null;
            }

            if (fileMetadataResponse) {
                fileMetadata = fileMetadataResponse.result;
                let thumbnailPath = fileMetadata?.thumbnails[fileMetadata.thumbnails.length - 1]?.relative_path;
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
