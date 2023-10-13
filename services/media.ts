import { exec } from "child_process";
import config from "config";
import { promises as fs } from "fs";
import { join } from "path";

import { EmbassyApiConfig } from "../config/schema";
import { getBufferFromResponse, getFromHass, postToHass } from "../utils/network";
import logger from "./logger";

const embassyApiConfig = config.get<EmbassyApiConfig>("embassy-api");

const doorcamPath = embassyApiConfig.doorcam;
const webcamPath = embassyApiConfig.webcam;
const webcam2Path = embassyApiConfig.webcam2;
const ttspath = embassyApiConfig.ttspath;
const playpath = embassyApiConfig.playpath;
const doorbellpath = embassyApiConfig.doorbellpath;

export async function getDoorcamImage(): Promise<Buffer> {
    return getBufferFromResponse(await getFromHass(doorcamPath));
}

export async function getWebcamImage(): Promise<Buffer> {
    return getBufferFromResponse(await getFromHass(webcamPath));
}

export async function getWebcam2Image(): Promise<Buffer> {
    return getBufferFromResponse(await getFromHass(webcam2Path));
}

export async function getRandomImageFromFolder(folder: string): Promise<Nullable<Buffer>> {
    const files = await fs.readdir(folder);
    if (files.length === 0) return null;

    const fileindex = Math.floor(Math.random() * files.length);
    return await fs.readFile(join(folder, files[fileindex]));
}
export async function getImageFromPath(path: string): Promise<Nullable<Buffer>> {
    return await fs.readFile(path);
}

/** @deprecated Use HASS */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getImageFromRTSP(url: string, filename: string): Promise<Buffer> {
    const child = exec(`ffmpeg -i rtsp://${url} -frames:v 1 -f image2 ${filename}.jpg -y`, (error, stdout, stderr) => {
        if (error) {
            logger.error(`error: ${error.message}`);
            return;
        }
        if (stderr) {
            logger.error(`stderr: ${stderr}`);
            return;
        }
        logger.info(`stdout: ${stdout}`);
    });

    await new Promise(resolve => {
        child.on("close", resolve);
    });

    return await fs.readFile("./tmp.jpg");
}

export async function sayInSpace(text: string): Promise<void> {
    const response = await postToHass(ttspath, {
        entity_id: "media_player.hackem_speaker",
        message: text,
        language: "ru",
    });

    if (response.status !== 200) throw Error("Speaker request failed");
}

export async function playInSpace(link: string): Promise<void> {
    const response = await postToHass(playpath, {
        entity_id: "media_player.hackem_speaker",
        media_content_id: link,
        media_content_type: "music",
    });

    if (response.status !== 200) throw Error("Speaker request failed");
}

export async function ringDoorbell(): Promise<void> {
    const response = await postToHass(doorbellpath, {
        entity_id: "switch.doorbell",
    });

    if (response.status !== 200) throw Error("Ringing request failed");
}
