import { Message } from "node-telegram-bot-api";

import NeedsRepository from "../../repositories/needsRepository";
import t from "../../services/localization";
import * as TextGenerators from "../../services/textGenerators";
import * as UsersHelper from "../../services/usersHelper";
import HackerEmbassyBot from "../HackerEmbassyBot";

export default class NeedsHandlers {
    static async needsHandler(bot: HackerEmbassyBot, msg: Message) {
        const needs = NeedsRepository.getOpenNeeds();
        const text = TextGenerators.getNeedsList(needs, bot.context(msg).mode);
        const inline_keyboard = needs
            ? needs.map(need => [
                  {
                      text: need.text,
                      callback_data: JSON.stringify({ command: "/bought", id: need.id }),
                  },
              ])
            : [];

        await bot.sendMessageExt(msg.chat.id, text, msg, {
            reply_markup: { inline_keyboard },
        });
    }

    static async buyHandler(bot: HackerEmbassyBot, msg: Message, item: string) {
        const requester = msg.from?.username;
        const success = requester && NeedsRepository.addBuy(item, requester, new Date());

        await bot.sendMessageExt(
            msg.chat.id,
            success
                ? t("needs.buy.success", { username: UsersHelper.formatUsername(requester, bot.context(msg).mode), item })
                : t("needs.buy.fail"),
            msg
        );
    }

    static async boughtByIdHandler(bot: HackerEmbassyBot, msg: Message, id: number) {
        await NeedsHandlers.boughtHandler(bot, msg, NeedsRepository.getNeedById(id)?.text ?? "");
    }

    static boughtUndoHandler(_: HackerEmbassyBot, msg: Message, id: number) {
        const need = NeedsRepository.getNeedById(id);

        if (need && need.buyer === msg.from?.username) {
            return NeedsRepository.undoClose(need.id);
        }

        return false;
    }

    static async boughtHandler(bot: HackerEmbassyBot, msg: Message, item: string) {
        const buyer = msg.from?.username;
        const need = NeedsRepository.getOpenNeedByText(item);

        if (!need || need.buyer) {
            bot.sendMessageExt(msg.chat.id, t("needs.bought.notfound"), msg);
            return;
        }

        if (!buyer) {
            bot.sendMessageExt(msg.chat.id, t("needs.general.error"), msg);
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
