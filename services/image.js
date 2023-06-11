const fs = require("fs").promises;
const path = require("path");

/**
 * @param {string} folder
 * @returns {Promise<Buffer>}
 */
async function getRandomImageFromFolder(folder) {
    let files = await fs.readdir(folder);
    if (!files || files.length === 0) return;

    let fileindex = Math.floor(Math.random() * files.length);
    return await fs.readFile(path.join(folder, files[fileindex]));
}

module.exports = { getRandomImageFromFolder };
