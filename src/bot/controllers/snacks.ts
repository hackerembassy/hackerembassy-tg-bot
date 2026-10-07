import { InlineKeyboardButton, Message } from "node-telegram-bot-api";

import { Snack } from "@data/models";

import { hasRole, userService } from "@services/domain/user";
import { hackemcoinsService } from "@services/domain/hackemcoins";
import { snacksService, SnackChange } from "@services/domain/snacks";
import { FeatureFlag, Members, Route, UserRoles } from "@hackembot/core/decorators";

import HackerEmbassyBot from "../core/classes/HackerEmbassyBot";
import { AnnoyingInlineButton, ButtonFlags, chunkButtonsForMobile, InlineButton, isAnnoyingChat } from "../core/inlineButtons";
import t from "../core/localization";
import { BotController } from "../core/types";
import * as helpers from "../core/helpers";
import * as TextGenerators from "../text";

const CaptureSnackAndNumber = helpers.OptionalParam(/(.*\S) (\d+)/);

// Outside a private chat the list is shared, so tapping a snack answers with a new message instead of editing it
const SnackButtonFlags: Partial<Record<Message["chat"]["type"], ButtonFlags>> = { private: ButtonFlags.Editing };

export default class SnacksController implements BotController {
    // Telegram can deliver a second tap on "take" before the confirmation is edited away
    private static readonly usedConfirmations = new Set<string>();

    @Route(["snacks"])
    @FeatureFlag("hackemcoins")
    static snacksHandler(bot: HackerEmbassyBot, msg: Message) {
        const user = bot.context(msg).user;
        const isResident = hasRole(user, "admin", ...Members);
        const snacks = snacksService.getSnacks().filter(snack => isResident || snack.stock > 0);
        const text = TextGenerators.getSnacksList(snacks, hackemcoinsService.getBalance(user.userid));
        const options = { reply_markup: { inline_keyboard: SnacksController.snackButtons(bot, msg, snacks) } };

        if (bot.context(msg).isEditing) return bot.sendOrEditMessage(msg.chat.id, text, msg, options, msg.message_id);

        return bot.sendLongMessage(msg.chat.id, text, msg, options);
    }

    @Route(["snack"])
    @FeatureFlag("hackemcoins")
    static snackHandler(bot: HackerEmbassyBot, msg: Message, snackId?: number) {
        if (snackId === undefined) return SnacksController.snacksHandler(bot, msg);

        const buyer = bot.context(msg).user;
        const snack = snacksService.getSnackById(snackId);
        const balance = hackemcoinsService.getBalance(buyer.userid);

        SnacksController.usedConfirmations.delete(SnacksController.confirmationKey(msg));

        if (!snack) return SnacksController.showStep(bot, msg, t("snacks.take.notfound"));
        if (snack.stock <= 0) return SnacksController.showStep(bot, msg, t("snacks.take.outofstock", { name: snack.name }));
        if (balance < snack.price)
            return SnacksController.showStep(
                bot,
                msg,
                t("snacks.take.insufficient", { name: snack.name, price: snack.price, balance })
            );

        const takeButton = InlineButton(t("snacks.buttons.take"), "snackbuy", ButtonFlags.Editing, {
            params: [snack.id, snack.price, buyer.userid],
        });

        return SnacksController.showStep(
            bot,
            msg,
            t("snacks.take.confirm", { name: snack.name, price: snack.price, balance, after: balance - snack.price }),
            [takeButton, SnacksController.backButton()]
        );
    }

    @Route(["snackbuy"])
    @FeatureFlag("hackemcoins")
    static async snackBuyHandler(bot: HackerEmbassyBot, msg: Message, snackId?: number, price?: number, buyerId?: number) {
        const buyer = bot.context(msg).user;
        const key = SnacksController.confirmationKey(msg);

        if (snackId === undefined || price === undefined || buyerId !== buyer.userid) return;
        if (SnacksController.usedConfirmations.has(key)) return;

        SnacksController.usedConfirmations.add(key);

        const result = snacksService.purchase(snackId, price, buyer);

        if (result.status === "notfound") return SnacksController.showStep(bot, msg, t("snacks.take.notfound"));
        if (result.status === "outofstock")
            return SnacksController.showStep(bot, msg, t("snacks.take.outofstock", { name: result.snack.name }));
        if (result.status === "pricechanged")
            return SnacksController.showStep(
                bot,
                msg,
                t("snacks.take.pricechanged", { name: result.snack.name, price: result.snack.price })
            );
        if (result.status === "insufficient")
            return SnacksController.showStep(
                bot,
                msg,
                t("snacks.take.insufficient", { name: result.snack.name, price: result.snack.price, balance: result.balance })
            );

        const params = {
            id: result.transaction.id,
            username: helpers.userLink(buyer),
            name: result.snack.name,
            price: result.snack.price,
            stock: result.snack.stock,
            balance: result.balance,
        };

        await SnacksController.showStep(bot, msg, t("snacks.take.success", params), [
            InlineButton(t("snacks.buttons.list"), "snacks", ButtonFlags.Editing),
        ]);
        await bot.sendAlert(t("snacks.take.log", params));

        return;
    }

    @Route(["addsnack"], helpers.OptionalParam(/(.*\S) price (\d+)(?: stock (\d+))?/), match => [match[1], match[2], match[3]])
    @UserRoles(Members)
    @FeatureFlag("hackemcoins")
    static async addSnackHandler(bot: HackerEmbassyBot, msg: Message, name?: string, priceString?: string, stockString?: string) {
        if (!name || !priceString) return bot.sendMessageExt(msg.chat.id, t("snacks.add.help"), msg);

        const price = Number(priceString);
        const stock = stockString ? Number(stockString) : 0;

        if (!Number.isSafeInteger(price) || !Number.isSafeInteger(stock))
            return bot.sendMessageExt(msg.chat.id, t("snacks.errors.number"), msg);

        const creator = bot.context(msg).user;
        const snack = snacksService.addSnack(name, price, stock, creator);

        if (!snack) return bot.sendMessageExt(msg.chat.id, t("snacks.add.exists", { name }), msg);

        const params = { username: helpers.userLink(creator), name: snack.name, price: snack.price, stock: snack.stock };

        await bot.sendMessageExt(msg.chat.id, t("snacks.add.success", params), msg);
        await bot.sendAlert(t("snacks.add.log", params));

        return;
    }

    @Route(["setsnackstock"], CaptureSnackAndNumber, match => [match[1], match[2]])
    @UserRoles(Members)
    @FeatureFlag("hackemcoins")
    static setStockHandler(bot: HackerEmbassyBot, msg: Message, name?: string, stockString?: string) {
        if (!name || !stockString) return bot.sendMessageExt(msg.chat.id, t("snacks.stock.help"), msg);

        const stock = Number(stockString);

        if (!Number.isSafeInteger(stock)) return bot.sendMessageExt(msg.chat.id, t("snacks.errors.number"), msg);

        return SnacksController.replyToSnackChange(bot, msg, "stock", name, snacksService.setStock(name, stock));
    }

    @Route(["setsnackprice"], CaptureSnackAndNumber, match => [match[1], match[2]])
    @UserRoles(Members)
    @FeatureFlag("hackemcoins")
    static setPriceHandler(bot: HackerEmbassyBot, msg: Message, name?: string, priceString?: string) {
        if (!name || !priceString) return bot.sendMessageExt(msg.chat.id, t("snacks.price.help"), msg);

        const price = Number(priceString);

        if (!Number.isSafeInteger(price)) return bot.sendMessageExt(msg.chat.id, t("snacks.errors.number"), msg);

        return SnacksController.replyToSnackChange(bot, msg, "price", name, snacksService.setPrice(name, price));
    }

    @Route(["removesnack"], helpers.OptionalParam(/(.*\S)/), match => [match[1]])
    @UserRoles(Members)
    @FeatureFlag("hackemcoins")
    static removeSnackHandler(bot: HackerEmbassyBot, msg: Message, name?: string) {
        if (!name) return bot.sendMessageExt(msg.chat.id, t("snacks.remove.help"), msg);

        return SnacksController.replyToSnackChange(bot, msg, "remove", name, snacksService.removeSnack(name));
    }

    @Route(["undosnack"], helpers.OptionalParam(/(\d+)/), match => [match[1]])
    @UserRoles(Members)
    @FeatureFlag("hackemcoins")
    static async undoSnackHandler(bot: HackerEmbassyBot, msg: Message, purchaseIdString?: string) {
        if (!purchaseIdString) return bot.sendMessageExt(msg.chat.id, t("snacks.undo.help"), msg);

        const actor = bot.context(msg).user;
        const result = snacksService.undoPurchase(Number(purchaseIdString), actor);

        if (result.status === "notfound")
            return bot.sendMessageExt(msg.chat.id, t("snacks.undo.notfound", { id: purchaseIdString }), msg);
        if (result.status === "alreadyundone")
            return bot.sendMessageExt(msg.chat.id, t("snacks.undo.already", { id: purchaseIdString }), msg);

        const buyer = userService.getUser(result.purchase.user_id);
        const params = {
            id: result.purchase.id,
            actor: helpers.userLink(actor),
            username: buyer ? helpers.userLink(buyer) : result.purchase.user_id,
            name: result.snack.name,
            amount: result.transaction.amount,
            stock: result.snack.stock,
            balance: result.balance,
        };

        await bot.sendMessageExt(msg.chat.id, t("snacks.undo.success", params), msg);
        await bot.sendAlert(t("snacks.undo.log", params));

        if (buyer && buyer.userid !== actor.userid) await bot.sendDirectMessage(buyer, "hackemcoins.received.refund", params);

        return;
    }

    private static snackButtons(bot: HackerEmbassyBot, msg: Message, snacks: Snack[]): InlineKeyboardButton[][] {
        if (isAnnoyingChat(bot, msg)) return [[AnnoyingInlineButton(bot, msg, t("snacks.buttons.shop"), "snacks")]];

        const flags = SnackButtonFlags[msg.chat.type] ?? ButtonFlags.Simple;
        const buttons = snacks
            .filter(snack => snack.stock > 0)
            .map(snack => InlineButton(`${snack.name} · ${snack.price} HC`, "snack", flags, { params: snack.id }));

        return chunkButtonsForMobile(buttons, 2);
    }

    private static backButton() {
        return InlineButton(t("snacks.buttons.back"), "snacks", ButtonFlags.Editing);
    }

    private static showStep(bot: HackerEmbassyBot, msg: Message, text: string, buttons = [SnacksController.backButton()]) {
        return bot.sendOrEditMessage(msg.chat.id, text, msg, { reply_markup: { inline_keyboard: [buttons] } }, msg.message_id);
    }

    private static confirmationKey(msg: Message) {
        return `${msg.chat.id}:${msg.message_id}`;
    }

    static async replyToSnackChange(
        bot: HackerEmbassyBot,
        msg: Message,
        change: "stock" | "price" | "remove",
        name: string,
        result: Optional<SnackChange>
    ) {
        if (!result) return bot.sendMessageExt(msg.chat.id, t("snacks.errors.notfound", { name }), msg);

        const params = {
            username: helpers.userLink(bot.context(msg).user),
            name: result.snack.name,
            previousStock: result.previous.stock,
            stock: result.snack.stock,
            previousPrice: result.previous.price,
            price: result.snack.price,
        };

        await bot.sendMessageExt(msg.chat.id, t(`snacks.${change}.success`, params), msg);
        await bot.sendAlert(t(`snacks.${change}.log`, params));

        return;
    }
}
