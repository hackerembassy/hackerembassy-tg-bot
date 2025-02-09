import { Router } from "express";
import config from "config";
import { NodeSSH } from "node-ssh";

import { EmbassyApiConfig } from "@config";
import logger from "@services/common/logger";
import { DeviceCheckingMethod } from "@services/embassy/embassy";
import { wakeOnLan, ping, NeworkDevicesLocator, arp } from "@utils/network";

const embassyApiConfig = config.get<EmbassyApiConfig>("embassy-api");

const luciToken = process.env["LUCITOKEN"];
const wifiUser = process.env["WIFIUSER"];
const wifiPassword = process.env["WIFIPASSWORD"];
const unifiUser = process.env["UNIFIUSER"];
const unifiPassword = process.env["UNIFIPASSWORD"];
const gamingUser = process.env["GAMINGUSER"];
const gamingPassword = process.env["GAMINGPASSWORD"];

const router = Router();

function linkMacPage(mac: string) {
    return `<html>\
        <head>\
        </head>\
        <body style="margin:0;">\
            <a onclick="event.target.innerText = 'You can close this window now'; window.close();" \
            style="display:block;height: 100dvh;margin: 0;box-sizing: border-box;text-align: center;padding: 35vh 10vw;background: brown;text-decoration: none;font-size: 9vw;color: white;box-shadow: 0 0 10vw black inset;text-shadow: 0 0 1vw #000000;" \
            href=https://t.me/${embassyApiConfig.tgbot.username}?start=setmac__${mac.replaceAll(
                ":",
                "-"
            )}>Press to set your mac to ${mac}</a>\
        </body>\
    </html>`;
}

/**
 * Endpoint to get mac addresses of devices, which are currently connected to the space internal network
 * It's used for autoinside and unlock purposes
 */
router.get("/inside", async (req, res, next) => {
    try {
        const method = req.query.method;

        switch (method) {
            case DeviceCheckingMethod.OpenWRT:
                if (!luciToken) throw Error("Missing Luci token");

                // We don't use our Xiaomi openWRT device as wifi access point anymore
                res.json(await NeworkDevicesLocator.getDevicesFromOpenWrt(embassyApiConfig.spacenetwork.routerip, luciToken));
                break;
            case DeviceCheckingMethod.Scan:
                // Use Keenetic method if possible, network scan is very unreliable (especialy for apple devices)
                res.json(await NeworkDevicesLocator.findDevicesUsingNmap(embassyApiConfig.spacenetwork.networkRange));
                break;
            case DeviceCheckingMethod.Unifi:
                // Use Keenetic method if possible, network scan is very unreliable (especialy for apple devices)
                if (!unifiUser || !unifiPassword) throw Error("Missing unifi credentials");

                res.json(
                    await NeworkDevicesLocator.getDevicesFromUnifiController(
                        embassyApiConfig.spacenetwork.unifiorigin,
                        unifiUser,
                        unifiPassword
                    )
                );
                break;
            // Our main wifi access point
            case DeviceCheckingMethod.Keenetic:
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

router.get("/linkmac", async (req, res, next) => {
    try {
        const ip = req.ip;

        if (!ip) throw Error("Missing IP");

        const mac = await arp(ip.replace("::ffff:", ""), embassyApiConfig.spacenetwork.networkRange);

        res.send(linkMacPage(mac));
    } catch (error) {
        next(error);
    }
});

router.post("/:name/wake", async (req, res, next): Promise<any> => {
    try {
        const device = req.params.name;
        const mac = embassyApiConfig.devices[device]?.mac;

        if (!mac) return res.sendStatus(400).send({ message: "Device not found" });

        const wasPacketSent = await wakeOnLan(mac);

        if (!wasPacketSent) return res.sendStatus(500).send({ message: "Failed to send magic packet" });

        logger.info(`Woke up ${mac}`);

        res.send({ message: "Magic packet sent" });
    } catch (error) {
        next(error);
    }
});

router.post("/:name/shutdown", async (req, res, next): Promise<any> => {
    try {
        const device = req.params.name;
        const host = embassyApiConfig.devices[device]?.host;

        if (!host) return res.sendStatus(400).send({ message: "Device not found" });

        const os = embassyApiConfig.devices[device]?.os;
        const command = os === "windows" ? "shutdown /s" : "shutdown now";
        const ssh = new NodeSSH();
        await ssh.connect({
            host,
            username: gamingUser,
            password: gamingPassword,
        });
        await ssh.exec(command, [""]);
        ssh.dispose();

        res.sendStatus(200);
    } catch (error) {
        next(error);
    }
});

router.post("/:name/ping", async (req, res, next): Promise<any> => {
    try {
        const device = req.params.name;
        const host = embassyApiConfig.devices[device]?.host ?? device;

        if (!host) return res.sendStatus(400).send({ message: "Device not found" });

        res.send(await ping(host));
    } catch (error) {
        next(error);
    }
});

export default router;
