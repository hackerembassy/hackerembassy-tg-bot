import fs from "node:fs";
import path from "node:path";

import fetch from "node-fetch";
import { file } from "tmp-promise";

import logger from "@services/common/logger";

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

export function readFirstExistingFile(...files: string[]): string | null {
    for (const file of files) {
        if (fs.existsSync(file)) {
            return fs.readFileSync(file, "utf8");
        }
    }
    return null;
}

export function readJsonFile<T>(filePath: string): T | undefined {
    if (!fs.existsSync(filePath)) return undefined;

    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
    } catch (error) {
        logger.error(`Failed to read json file ${filePath}`);
        logger.error(error);
        return undefined;
    }
}

export async function writeJsonFileAtomic(filePath: string, data: unknown): Promise<void> {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });

    const tmpPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);

    await fs.promises.writeFile(tmpPath, JSON.stringify(data));
    await fs.promises.rename(tmpPath, filePath);
}

export { rootDir as PROJECT_ROOT } from "./meta";
