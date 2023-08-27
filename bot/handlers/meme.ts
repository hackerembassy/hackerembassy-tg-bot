import { Message } from "node-telegram-bot-api";
import { getRandomImageFromFolder } from "../../services/media";
import HackerEmbassyBot from "../HackerEmbassyBot";

export default class MemeHandlers {
    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async randomDogHandler(bot: HackerEmbassyBot, msg: Message) {
        await bot.sendPhotoExt(msg.chat.id, await getRandomImageFromFolder("./resources/images/dogs"), msg);
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async randomCatHandler(bot: HackerEmbassyBot, msg: Message) {
        await bot.sendPhotoExt(msg.chat.id, await getRandomImageFromFolder("./resources/images/cats"), msg);
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async randomCabHandler(bot: HackerEmbassyBot, msg: Message) {
        await bot.sendPhotoExt(msg.chat.id, await getRandomImageFromFolder("./resources/images/cab"), msg);
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async randomRoosterHandler(bot: HackerEmbassyBot, msg: Message) {
        await bot.sendPhotoExt(msg.chat.id, await getRandomImageFromFolder("./resources/images/roosters"), msg);
    }
}
