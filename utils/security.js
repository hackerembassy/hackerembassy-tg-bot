const fs = require("fs").promises;
const NodeRSA = require("node-rsa");

async function encrypt(message) {
    let key = new NodeRSA(await fs.readFile("./config/sec/pub.key", "utf8"));

    return key.encrypt(message, "base64");
}

async function decrypt(message) {
    let key = new NodeRSA(await fs.readFile("./config/sec/priv.key", "utf8"));
    let decryptedKey = key.decrypt(message);

    return decryptedKey.toString("utf8");
}

module.exports = { encrypt, decrypt };
