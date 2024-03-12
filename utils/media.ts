import { exec } from "child_process";
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
