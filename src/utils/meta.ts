import path from "node:path";
import url from "node:url";

export const rootDir = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../..");

export function getFilename(metaUrl: string) {
    return url.fileURLToPath(metaUrl);
}

export function getDirname(metaUrl: string) {
    return path.dirname(url.fileURLToPath(metaUrl));
}
