const { exec } = require("child_process");
const fs = require("fs").promises;
const path = require("path");
const config = require("config");
const { postToHass, getFromHass, getBufferFromResponse } = require("../utils/network");
const embassyApiConfig = config.get("embassy-api");
const doorcamPath = embassyApiConfig.doorcam;
const webcamPath = embassyApiConfig.webcam;
const webcam2Path = embassyApiConfig.webcam2;
const ttspath = embassyApiConfig.ttspath;
const playpath = embassyApiConfig.playpath;
const doorbellpath = embassyApiConfig.doorbellpath;

/**
 * @returns {Promise<Buffer>}
 */
async function getDoorcamImage() {
    return getBufferFromResponse(await getFromHass(doorcamPath));
}

/**
 * @returns {Promise<Buffer>}
 */
async function getWebcamImage() {
    return getBufferFromResponse(await getFromHass(webcamPath));
}

/**
 * @returns {Promise<Buffer>}
 */
async function getWebcam2Image() {
    return getBufferFromResponse(await getFromHass(webcam2Path));
}

/**
 * @param {string} folder
 * @returns {Promise<Buffer>}
 */
async function getRandomImageFromFolder(folder) {
    let files = await fs.readdir(folder);
    if (!files || files.length === 0) return;

    let fileindex = Math.floor(Math.random() * files.length);
    return await fs.readFile(path.join(folder, files[fileindex]));
}

/**
 * @deprecated Use HASS
 * @param {string} url
 * @param {string} filename
 * @returns {Promise<Buffer>}
 */
// eslint-disable-next-line no-unused-vars
async function getImageFromRTSP(url, filename) {
    let child = exec(`ffmpeg -i rtsp://${url} -frames:v 1 -f image2 ${filename}.jpg -y`, (error, stdout, stderr) => {
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
async function sayInSpace(text) {
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
async function playInSpace(link) {
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
async function ringDoorbell() {
    const response = await postToHass(doorbellpath, {
        entity_id: "switch.doorbell",
    });

    if (response.status !== 200) throw Error("Ringing request failed");
}

module.exports = {
    getDoorcamImage,
    getWebcamImage,
    getWebcam2Image,
    sayInSpace,
    playInSpace,
    ringDoorbell,
    getRandomImageFromFolder,
};
