import { InlineKeyboardButton, Message } from "node-telegram-bot-api";

import NeedsRepository from "../../repositories/needsRepository";
import t from "../../services/localization";
import * as TextGenerators from "../../services/textGenerators";
import HackerEmbassyBot from "../core/HackerEmbassyBot";
import { ButtonFlags, InlineButton } from "../core/InlineButtons";
import { BotHandlers } from "../core/types";
import * as helpers from "../helpers";

export default class NeedsHandlers implements BotHandlers {
    static async needsHandler(bot: HackerEmbassyBot, msg: Message) {
        const needs = NeedsRepository.getOpenNeeds();
        const text = TextGenerators.getNeedsList(needs, bot.context(msg).mode);

        const needs_keyboard = needs
            ? needs.map(need => [InlineButton(need.text, "boughtbutton", ButtonFlags.Simple, { params: need.id })])
            : [];

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

    static async buyHandler(bot: HackerEmbassyBot, msg: Message, item: string) {
        const requester = msg.from?.username;
        const success = requester && NeedsRepository.addBuy(item, requester, new Date());

        await bot.sendMessageExt(
            msg.chat.id,
            success
                ? t("needs.buy.success", { username: helpers.formatUsername(requester, bot.context(msg).mode), item })
                : t("needs.buy.fail"),
            msg
        );
    }

    static async boughtByIdHandler(bot: HackerEmbassyBot, msg: Message, id: number) {
        await NeedsHandlers.boughtHandler(bot, msg, NeedsRepository.getNeedById(id)?.text ?? "");
    }

    static async boughtUndoHandler(bot: HackerEmbassyBot, msg: Message, id: number) {
        const need = NeedsRepository.getNeedById(id);

        if (need && need.buyer === msg.from?.username && NeedsRepository.undoClose(need.id)) {
            await bot.deleteMessage(msg.chat.id, msg.message_id);
        }
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
            username: helpers.formatUsername(buyer, bot.context(msg).mode),
            item,
        });
        const inline_keyboard = [[InlineButton(t("needs.bought.undo"), "boughtundo", ButtonFlags.Simple, { params: need.id })]];

        await bot.sendMessageExt(msg.chat.id, successText, msg, {
            reply_markup: { inline_keyboard },
        });
    }

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
