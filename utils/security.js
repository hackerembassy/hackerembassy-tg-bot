const fs = require("fs").promises;
const NodeRSA = require('node-rsa');

async function encrypt(){
    let key = new NodeRSA(await fs.readFile("./sec/pub.key", 'utf8'));

    return key.encrypt(process.env["UNLOCKKEY"], "base64");
}

async function decrypt(){
    let key = new NodeRSA(await fs.readFile("./sec/priv.key", 'utf8'));
    let decryptedKey = key.decrypt(req.body.token);

    return decryptedKey.toString("utf8");
}

module.exports = {encrypt, decrypt}