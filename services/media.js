const { default: fetch } = require("node-fetch");
const { exec } = require("child_process");
const fs = require("fs").promises;
const config = require("config");
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
    return await getImageFromHTTP(doorcamPath, process.env["HASSTOKEN"]);
}

/**
 * @returns {Promise<Buffer>}
 */
async function getWebcamImage() {
    return await getImageFromHTTP(webcamPath, process.env["HASSTOKEN"]);
}

/**
 * @returns {Promise<Buffer>}
 */
async function getWebcam2Image() {
    return await getImageFromHTTP(webcam2Path, process.env["HASSTOKEN"]);
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
 * @param {string} url
 * @param {string} token
 * @returns {Promise<Buffer>}
 */
async function getImageFromHTTP(url, token) {
    const response = await fetch(`${url}`, {
        headers: {
            Authorization: token ? `Bearer ${token}` : "",
            "Content-Type": "application/json",
        },
    });
    const imgbuffer = await response.arrayBuffer();

    return Buffer.from(imgbuffer);
}

/**
 * @param {string} text
 * @returns {Promise<void>}
 */
async function sayInSpace(text) {
    const response = await fetch(ttspath, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env["HASSTOKEN"]}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            entity_id: "media_player.hackem_speaker",
            message: text,
            language: "ru",
        }),
    });

    if (response.status !== 200) throw Error("Speaker request failed");
}

/**
 * @param {string} link
 * @returns {Promise<void>}
 */
async function playInSpace(link) {
    const response = await fetch(playpath, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env["HASSTOKEN"]}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            entity_id: "media_player.hackem_speaker",
            media_content_id: link,
            media_content_type: "music",
        }),
    });

    if (response.status !== 200) throw Error("Speaker request failed");
}

/**
 * @returns {Promise<void>}
 */
async function ringDoorbell() {
    const response = await fetch(doorbellpath, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env["HASSTOKEN"]}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            entity_id: "switch.doorbell",
        }),
    });

    if (response.status !== 200) throw Error("Ringing request failed");
}

module.exports = { getDoorcamImage, getWebcamImage, getWebcam2Image, sayInSpace, playInSpace, ringDoorbell };
