import fs from "fs";
import path from "path";

import fetch from "node-fetch";

import { file } from "tmp-promise";

export function lastModifiedFilePath(logfolderpath: string): string | undefined {
    const files = fs.readdirSync(logfolderpath);

    return files.length > 0
        ? files.reduce((prev, curr) => {
              const prevTime = fs.statSync(path.join(logfolderpath, prev)).mtime;
              const currTime = fs.statSync(path.join(logfolderpath, curr)).mtime;
              return prevTime > currTime ? prev : curr;
          })
        : undefined;
}

export function getImageFromFolder(folder: string, filename: string): Promise<Nullable<Buffer>> {
    return fs.promises.readFile(path.join(folder, filename));
}

export async function getRandomImageFromFolder(folder: string): Promise<Nullable<Buffer>> {
    const files = await fs.promises.readdir(folder);
    if (files.length === 0) return null;

    const fileindex = Math.floor(Math.random() * files.length);
    return await fs.promises.readFile(path.join(folder, files[fileindex]));
}
export async function getImageFromPath(path: string): Promise<Nullable<Buffer>> {
    return await fs.promises.readFile(path);
}

//function to read any file as base64 string
export async function readFileAsBase64(path: string): Promise<string> {
    const file = await fs.promises.readFile(path);
    return file.toString("base64");
}

export async function downloadTmpFile(url: string, postfix: string) {
    const { path: tmpPath, cleanup } = await file({ postfix });
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();

    await fs.promises.writeFile(tmpPath, Buffer.from(buffer));

    return { tmpPath, cleanup };
}
