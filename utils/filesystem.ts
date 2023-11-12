import fs from "fs";
import path from "path";

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

export async function getRandomImageFromFolder(folder: string): Promise<Nullable<Buffer>> {
    const files = await fs.promises.readdir(folder);
    if (files.length === 0) return null;

    const fileindex = Math.floor(Math.random() * files.length);
    return await fs.promises.readFile(path.join(folder, files[fileindex]));
}
export async function getImageFromPath(path: string): Promise<Nullable<Buffer>> {
    return await fs.promises.readFile(path);
}
