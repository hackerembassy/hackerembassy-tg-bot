import HackerEmbassyBot from "../core/classes/HackerEmbassyBot";
import { addHackemcoinsListeners } from "./hackemcoins";
import { addSpaceListeners } from "./space";

export function addBotListeners(bot: HackerEmbassyBot) {
    addSpaceListeners(bot);
    addHackemcoinsListeners(bot);
}
