// eslint-disable-next-line no-unused-vars
const TelegramBot = require("node-telegram-bot-api");

/**
 * @param {TelegramBot.Message} msg
 */
function isMessageFromPrivateChat(msg) {
    return msg?.chat.type === "private";
}

module.exports = { isMessageFromPrivateChat };
