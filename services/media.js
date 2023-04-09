
const { exec } = require("child_process");
const fs = require("fs").promises;
const config = require("config");
const embassyApiConfig = config.get("embassy-api");
const doorcamPath = embassyApiConfig.doorcam;

async function getDoorcamImage(){
    let child = exec(`ffmpeg -i rtsp://${doorcamPath} -frames:v 1 -f image2 tmp.jpg -y`, (error, stdout, stderr) => {
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

module.exports = { getDoorcamImage}