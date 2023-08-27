import { Message } from "node-telegram-bot-api";
import HackerEmbassyBot from "../HackerEmbassyBot";

import NeedsRepository from "../../repositories/needsRepository";
import TextGenerators from "../../services/textGenerators";
import UsersHelper from "../../services/usersHelper";

import t from "../../services/localization";

export default class NeedsHandlers {
    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async needsHandler(bot: HackerEmbassyBot, msg: Message) {
        const needs = NeedsRepository.getOpenNeeds();
        const text = TextGenerators.getNeedsList(needs, bot.context(msg).mode);
        const inline_keyboard = needs.map(need => [
            {
                text: need.text,
                callback_data: JSON.stringify({ command: "/bought", id: need.id }),
            },
        ]);

        await bot.sendMessageExt(msg.chat.id, text, msg, {
            reply_markup: { inline_keyboard },
        });
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async buyHandler(bot: HackerEmbassyBot, msg: Message, item) {
        const requester = msg.from.username;
        const success = NeedsRepository.addBuy(item, requester, new Date());

        await bot.sendMessageExt(
            msg.chat.id,
            success
                ? t("needs.buy.success", { username: UsersHelper.formatUsername(requester, bot.context(msg).mode), item })
                : t("needs.buy.fail"),
            msg
        );
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async boughtByIdHandler(bot: HackerEmbassyBot, msg: Message, id) {
        await this.boughtHandler(bot, msg, NeedsRepository.getNeedById(id).text || "");
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async boughtUndoHandler(bot: HackerEmbassyBot, msg: Message, id) {
        const need = NeedsRepository.getNeedById(id);

        if (need && need.buyer === msg.from.username) {
            NeedsRepository.undoClose(need.id);
            return true;
        }

        return false;
    }

    /**
     * @param {HackerEmbassyBot} bot
     * @param {Message} msg
     */
    static async boughtHandler(bot: HackerEmbassyBot, msg: Message, item) {
        const buyer = msg.from.username;
        const need = NeedsRepository.getOpenNeedByText(item);

        if (!need || need.buyer) {
            bot.sendMessageExt(msg.chat.id, t("needs.bought.notfound"), msg);
            return;
        }

        NeedsRepository.closeNeed(item, buyer, new Date());

        const successText = t("needs.bought.success", {
            username: UsersHelper.formatUsername(buyer, bot.context(msg).mode),
            item,
        });
        const inline_keyboard = [
            [
                {
                    text: t("needs.bought.undo"),
                    callback_data: JSON.stringify({ command: "/bought_undo", id: need.id }),
                },
            ],
        ];

        await bot.sendMessageExt(msg.chat.id, successText, msg, {
            reply_markup: { inline_keyboard },
        });
    }
}
