const path = require("path");
const fs = require("fs");

/**
 * @param {string} logpath
 */
function lastModifiedFilePath(logpath) {
    const files = fs.readdirSync(logpath);

    return files?.length > 0
        ? files.reduce((prev, curr) => {
              const prevTime = fs.statSync(path.join(logpath, prev)).mtime;
              const currTime = fs.statSync(path.join(logpath, curr)).mtime;
              return prevTime > currTime ? prev : curr;
          })
        : null;
}

module.exports = { lastModifiedFilePath };
