import { InlineKeyboardButton, Message } from "node-telegram-bot-api";

import NeedsRepository from "@repositories/needs";
import { Route } from "@hackembot/core/decorators";

import HackerEmbassyBot from "../core/HackerEmbassyBot";
import { ButtonFlags, InlineButton } from "../core/InlineButtons";
import t from "../core/localization";
import { BotHandlers } from "../core/types";
import * as helpers from "../core/helpers";
import * as TextGenerators from "../textGenerators";

export default class NeedsHandlers implements BotHandlers {
    @Route(["needs"])
    static async needsHandler(bot: HackerEmbassyBot, msg: Message) {
        const needs = NeedsRepository.getOpenNeeds();
        const text = TextGenerators.getNeedsList(needs);

        const needs_keyboard = needs.map(need => [
            InlineButton(need.item, "boughtbutton", ButtonFlags.Simple, { params: need.id }),
        ]);

        const default_inline_keyboard = [[InlineButton(t("general.buttons.menu"), "startpanel", ButtonFlags.Editing)]];

        await bot.sendOrEditMessage(
            msg.chat.id,
            text,
            msg,
            {
                reply_markup: { inline_keyboard: [...needs_keyboard, ...default_inline_keyboard] },
            },
            msg.message_id
        );
    }

    @Route(["buy", "need"], /(.*)/, match => [match[1]])
    static async buyHandler(bot: HackerEmbassyBot, msg: Message, item: string) {
        const requester = bot.context(msg).user;
        const success = NeedsRepository.addBuy(item, requester.userid, new Date());

        await bot.sendMessageExt(
            msg.chat.id,
            success ? t("needs.buy.success", { username: helpers.userLink(requester), item }) : t("needs.buy.fail"),
            msg
        );
    }

    static async boughtByIdHandler(bot: HackerEmbassyBot, msg: Message, id: number) {
        await NeedsHandlers.boughtHandler(bot, msg, NeedsRepository.getNeedById(id)?.item ?? "");
    }

    @Route(["boughtundo"], /(\d+)/, match => [match[1]])
    static async boughtUndoHandler(bot: HackerEmbassyBot, msg: Message, id: number) {
        const need = NeedsRepository.getNeedById(id);
        const sender = bot.context(msg).user;

        if (need && need.buyer_id === sender.userid && NeedsRepository.undoClose(need.id)) {
            await bot.deleteMessage(msg.chat.id, msg.message_id);
        }
    }

    @Route(["bought"], /(.*)/, match => [match[1]])
    static async boughtHandler(bot: HackerEmbassyBot, msg: Message, item: string) {
        const buyer = bot.context(msg).user;
        const need = NeedsRepository.getOpenNeedByItem(item);

        if (!need || need.buyer_id) {
            bot.sendMessageExt(msg.chat.id, t("needs.bought.notfound"), msg);
            return;
        }

        NeedsRepository.closeNeed(need.id, buyer.userid, new Date());

        const successText = t("needs.bought.success", {
            username: helpers.userLink(buyer),
            item,
        });
        const inline_keyboard = [[InlineButton(t("needs.bought.undo"), "boughtundo", ButtonFlags.Simple, { params: need.id })]];

        await bot.sendMessageExt(msg.chat.id, successText, msg, {
            reply_markup: { inline_keyboard },
        });
    }

    @Route(["boughtbutton"], null, match => [match[1]])
    static async boughtButtonHandler(bot: HackerEmbassyBot, message: Message, id: number, data: string): Promise<void> {
        await NeedsHandlers.boughtByIdHandler(bot, message, id);

        if (!message.reply_markup) return;

        const new_keyboard = message.reply_markup.inline_keyboard.filter(
            (button: InlineKeyboardButton[]) => button[0].callback_data !== data
        );

        if (new_keyboard.length !== message.reply_markup.inline_keyboard.length) {
            await bot.editMessageReplyMarkup(
                { inline_keyboard: new_keyboard },
                {
                    chat_id: message.chat.id,
                    message_id: message.message_id,
                }
            );
        }
    }
}
