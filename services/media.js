
const { exec } = require("child_process");
const fs = require("fs").promises;
const config = require("config");
const embassyApiConfig = config.get("embassy-api");
const doorcamPath = embassyApiConfig.doorcam;
const webcamPath = embassyApiConfig.webcam;
const webcam2Path = embassyApiConfig.webcam2;

async function getDoorcamImage(){
    return await getImageFromHTTP(doorcamPath, process.env["HASSTOKEN"]);
}

async function getWebcamImage(){
    return await getImageFromHTTP(webcamPath, process.env["HASSTOKEN"]);
}

async function getWebcam2Image(){
    return await getImageFromHTTP(webcam2Path);
}

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

    await new Promise( (resolve) => {
        child.on('close', resolve)
    })

    return await fs.readFile("./tmp.jpg");
}

async function getImageFromHTTP(url, token) {
    let response = await fetch(`${url}`, {
        headers:{
           "Authorization": token ? `Bearer ${token}`: "",
           "Content-Type": "application/json"
        }
    });
    let imgbuffer = await response.arrayBuffer();

    return Buffer.from(imgbuffer);
}

module.exports = { getDoorcamImage, getWebcamImage, getWebcam2Image }