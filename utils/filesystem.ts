import path from "path";
import fs from "fs";

export function lastModifiedFilePath(logfolderpath: string) {
    const files = fs.readdirSync(logfolderpath);

    return files?.length > 0
        ? files.reduce((prev, curr) => {
              const prevTime = fs.statSync(path.join(logfolderpath, prev)).mtime;
              const currTime = fs.statSync(path.join(logfolderpath, curr)).mtime;
              return prevTime > currTime ? prev : curr;
          })
        : null;
}
