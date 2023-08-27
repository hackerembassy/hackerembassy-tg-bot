import { exec } from "child_process";
import { promises as fs } from "fs";
import { join } from "path";
import { postToHass, getFromHass, getBufferFromResponse } from "../utils/network";
import config from "config";
const embassyApiConfig = config.get("embassy-api") as any;

const doorcamPath = embassyApiConfig.doorcam;
const webcamPath = embassyApiConfig.webcam;
const webcam2Path = embassyApiConfig.webcam2;
const ttspath = embassyApiConfig.ttspath;
const playpath = embassyApiConfig.playpath;
const doorbellpath = embassyApiConfig.doorbellpath;

/**
 * @returns {Promise<Buffer>}
 */
export async function getDoorcamImage(): Promise<Buffer> {
    return getBufferFromResponse(await getFromHass(doorcamPath));
}

/**
 * @returns {Promise<Buffer>}
 */
export async function getWebcamImage(): Promise<Buffer> {
    return getBufferFromResponse(await getFromHass(webcamPath));
}

/**
 * @returns {Promise<Buffer>}
 */
export async function getWebcam2Image(): Promise<Buffer> {
    return getBufferFromResponse(await getFromHass(webcam2Path));
}

/**
 * @param {string} folder
 * @returns {Promise<Buffer>}
 */
export async function getRandomImageFromFolder(folder: string): Promise<Buffer> {
    const files = await fs.readdir(folder);
    if (!files || files.length === 0) return;

    const fileindex = Math.floor(Math.random() * files.length);
    return await fs.readFile(join(folder, files[fileindex]));
}

/**
 * @deprecated Use HASS
 * @param {string} url
 * @param {string} filename
 * @returns {Promise<Buffer>}
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getImageFromRTSP(url: string, filename: string): Promise<Buffer> {
    const child = exec(`ffmpeg -i rtsp://${url} -frames:v 1 -f image2 ${filename}.jpg -y`, (error, stdout, stderr) => {
        if (error) {
            console.log(`error: ${error.message}`);
            return;
        }
        if (stderr) {
            console.log(`stderr: ${stderr}`);
            return;
        }
        console.log(`stdout: ${stdout}`);
    });

    await new Promise(resolve => {
        child.on("close", resolve);
    });

    return await fs.readFile("./tmp.jpg");
}

/**
 * @param {string} text
 * @returns {Promise<void>}
 */
export async function sayInSpace(text: string): Promise<void> {
    const response = await postToHass(ttspath, {
        entity_id: "media_player.hackem_speaker",
        message: text,
        language: "ru",
    });

    if (response.status !== 200) throw Error("Speaker request failed");
}

/**
 * @param {string} link
 * @returns {Promise<void>}
 */
export async function playInSpace(link: string): Promise<void> {
    const response = await postToHass(playpath, {
        entity_id: "media_player.hackem_speaker",
        media_content_id: link,
        media_content_type: "music",
    });

    if (response.status !== 200) throw Error("Speaker request failed");
}

/**
 * @returns {Promise<void>}
 */
export async function ringDoorbell(): Promise<void> {
    const response = await postToHass(doorbellpath, {
        entity_id: "switch.doorbell",
    });

    if (response.status !== 200) throw Error("Ringing request failed");
}
