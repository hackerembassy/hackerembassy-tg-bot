import { Message } from "node-telegram-bot-api";

import { hasRole, userService } from "@services/domain/user";
import { hackemcoinsService } from "@services/domain/hackemcoins";
import { snacksService, SnackChange } from "@services/domain/snacks";
import { FeatureFlag, Members, Route, UserRoles } from "@hackembot/core/decorators";

import HackerEmbassyBot from "../core/classes/HackerEmbassyBot";
import t from "../core/localization";
import { BotController } from "../core/types";
import * as helpers from "../core/helpers";
import * as TextGenerators from "../text";

const CaptureSnackAndNumber = helpers.OptionalParam(/(.*\S) (\d+)/);

export default class SnacksController implements BotController {
    @Route(["snacks"])
    @FeatureFlag("hackemcoins")
    static snacksHandler(bot: HackerEmbassyBot, msg: Message) {
        const user = bot.context(msg).user;
        const isResident = hasRole(user, "admin", ...Members);
        const snacks = snacksService.getSnacks().filter(snack => isResident || snack.stock > 0);

        return bot.sendLongMessage(
            msg.chat.id,
            TextGenerators.getSnacksList(snacks, hackemcoinsService.getBalance(user.userid)),
            msg
        );
    }

    @Route(["takesnack"], helpers.OptionalParam(/(.*\S)/), match => [match[1]])
    @FeatureFlag("hackemcoins")
    static async takeSnackHandler(bot: HackerEmbassyBot, msg: Message, name?: string) {
        if (!name) return bot.sendMessageExt(msg.chat.id, t("snacks.take.help"), msg);

        const buyer = bot.context(msg).user;
        const result = snacksService.purchase(name, buyer);

        if (result.status === "notfound") return bot.sendMessageExt(msg.chat.id, t("snacks.take.notfound", { name }), msg);
        if (result.status === "outofstock")
            return bot.sendMessageExt(msg.chat.id, t("snacks.take.outofstock", { name: result.snack.name }), msg);
        if (result.status === "insufficient")
            return bot.sendMessageExt(
                msg.chat.id,
                t("snacks.take.insufficient", { name: result.snack.name, price: result.snack.price, balance: result.balance }),
                msg
            );

        const params = {
            id: result.transaction.id,
            username: helpers.userLink(buyer),
            name: result.snack.name,
            price: result.snack.price,
            stock: result.snack.stock,
            balance: result.balance,
        };

        await bot.sendMessageExt(msg.chat.id, t("snacks.take.success", params), msg);
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
