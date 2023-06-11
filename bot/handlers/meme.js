const imageService = require("../../services/image");

class MemeHandlers {
    static randomDogHandler = async (bot, msg) => {
        let fileBuffer = await imageService.getRandomImageFromFolder("./resources/images/dogs");
        bot.sendPhoto(msg.chat.id, fileBuffer);
    };

    static randomCatHandler = async (bot, msg) => {
        let fileBuffer = await imageService.getRandomImageFromFolder("./resources/images/cats");
        bot.sendPhoto(msg.chat.id, fileBuffer);
    };

    static randomCabHandler = async (bot, msg) => {
        let fileBuffer = await imageService.getRandomImageFromFolder("./resources/images/cab");
        bot.sendPhoto(msg.chat.id, fileBuffer);
    };
}

module.exports = MemeHandlers;
