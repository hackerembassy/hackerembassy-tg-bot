const { getRandomImageFromFolder } = require("../../services/media");

/**
 * @typedef {import("../HackerEmbassyBot").HackerEmbassyBot} HackerEmbassyBot
 * @typedef {import("node-telegram-bot-api").Message} Message
 */

class MemeHandlers {
    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async randomDogHandler(bot, msg) {
        await bot.sendPhotoExt(msg.chat.id, await getRandomImageFromFolder("./resources/images/dogs"), msg);
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async randomCatHandler(bot, msg) {
        await bot.sendPhotoExt(msg.chat.id, await getRandomImageFromFolder("./resources/images/cats"), msg);
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async randomCabHandler(bot, msg) {
        await bot.sendPhotoExt(msg.chat.id, await getRandomImageFromFolder("./resources/images/cab"), msg);
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async randomRoosterHandler(bot, msg) {
        await bot.sendPhotoExt(msg.chat.id, await getRandomImageFromFolder("./resources/images/roosters"), msg);
    }
}

module.exports = MemeHandlers;
