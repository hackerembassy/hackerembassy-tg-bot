const { getRandomImageFromFolder } = require("../../services/media");

class MemeHandlers {
    static randomDogHandler = async (bot, msg) =>
        await bot.sendPhoto(msg.chat.id, await getRandomImageFromFolder("./resources/images/dogs"));

    static randomCatHandler = async (bot, msg) =>
        await bot.sendPhoto(msg.chat.id, await getRandomImageFromFolder("./resources/images/cats"));

    static randomCabHandler = async (bot, msg) =>
        await bot.sendPhoto(msg.chat.id, await getRandomImageFromFolder("./resources/images/cab"));

    static randomRoosterHandler = async (bot, msg) =>
        await bot.sendPhoto(msg.chat.id, await getRandomImageFromFolder("./resources/images/roosters"));
}

module.exports = MemeHandlers;
