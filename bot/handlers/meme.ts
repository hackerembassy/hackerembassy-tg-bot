import { Message } from "node-telegram-bot-api";

import { getRandomImageFromFolder } from "../../services/media";
import HackerEmbassyBot from "../HackerEmbassyBot";

export default class MemeHandlers {
    static async randomDogHandler(bot: HackerEmbassyBot, msg: Message) {
        await bot.sendPhotoExt(msg.chat.id, await getRandomImageFromFolder("./resources/images/dogs"), msg);
    }

    static async randomCatHandler(bot: HackerEmbassyBot, msg: Message) {
        await bot.sendPhotoExt(msg.chat.id, await getRandomImageFromFolder("./resources/images/cats"), msg);
    }

    static async randomCabHandler(bot: HackerEmbassyBot, msg: Message) {
        await bot.sendPhotoExt(msg.chat.id, await getRandomImageFromFolder("./resources/images/cab"), msg);
    }

    static async randomRoosterHandler(bot: HackerEmbassyBot, msg: Message) {
        await bot.sendPhotoExt(msg.chat.id, await getRandomImageFromFolder("./resources/images/roosters"), msg);
    }
}
