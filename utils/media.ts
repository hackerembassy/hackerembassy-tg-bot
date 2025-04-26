import { exec } from "child_process";
import { promises as fs } from "fs";
import path from "path";

export async function convertMedia(sourcePath: string, outputFormat: "mp3" | "ogg"): Promise<string> {
    const inputExtension = path.extname(sourcePath);
    const newFilePath = sourcePath.replace(inputExtension, `.${outputFormat}`);
    const child = exec(`ffmpeg -i ${sourcePath} ${newFilePath}`);
    await new Promise(resolve => {
        child.on("close", resolve);
    });

    return newFilePath;
}

/** @deprecated Use HASS */

export async function captureRTSPImage(url: string, filename: string): Promise<Buffer> {
    const child = exec(`ffmpeg -i rtsp://${url} -frames:v 1 -f image2 ${filename}.jpg -y`, (error, _stdout, stderr) => {
        if (error) throw new Error(error.message);
        if (stderr) throw Error(stderr);
    });

    await new Promise(resolve => {
        child.on("close", resolve);
    });

    return await fs.readFile("./tmp.jpg");
}
