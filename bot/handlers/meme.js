const { getRandomImageFromFolder } = require("../../services/media");

class MemeHandlers {
    static randomDogHandler = async (bot, msg) => {
        let fileBuffer = await getRandomImageFromFolder("./resources/images/dogs");
        await bot.sendPhoto(msg.chat.id, fileBuffer);
    };

    static randomCatHandler = async (bot, msg) => {
        let fileBuffer = await getRandomImageFromFolder("./resources/images/cats");
        await bot.sendPhoto(msg.chat.id, fileBuffer);
    };

    static randomCabHandler = async (bot, msg) => {
        let fileBuffer = await getRandomImageFromFolder("./resources/images/cab");
        await bot.sendPhoto(msg.chat.id, fileBuffer);
    };
}

module.exports = MemeHandlers;
