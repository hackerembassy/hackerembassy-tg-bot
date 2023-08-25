const path = require("path");
const fs = require("fs");

/**
 * @param {string} logfolderpath
 */
function lastModifiedFilePath(logfolderpath) {
    const files = fs.readdirSync(logfolderpath);

    return files?.length > 0
        ? files.reduce((prev, curr) => {
              const prevTime = fs.statSync(path.join(logfolderpath, prev)).mtime;
              const currTime = fs.statSync(path.join(logfolderpath, curr)).mtime;
              return prevTime > currTime ? prev : curr;
          })
        : null;
}

module.exports = { lastModifiedFilePath };
