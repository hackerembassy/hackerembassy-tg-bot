const BaseHandlers = require("./base");
const imageService = require("../../services/image");

class MemeHandlers extends BaseHandlers {
    constructor() {
        super();
    }

    randomDogHandler = async (msg) => {
        let fileBuffer = await imageService.getRandomImageFromFolder("./resources/images/dogs");
        this.bot.sendPhoto(msg.chat.id, fileBuffer);
    };

    randomCatHandler = async (msg) => {
        let fileBuffer = await imageService.getRandomImageFromFolder("./resources/images/cats");
        this.bot.sendPhoto(msg.chat.id, fileBuffer);
    };

    randomCabHandler = async (msg) => {
        let fileBuffer = await imageService.getRandomImageFromFolder("./resources/images/cab");
        this.bot.sendPhoto(msg.chat.id, fileBuffer);
    };
}

module.exports = MemeHandlers;
