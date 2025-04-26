import fs from "fs/promises";
import path from "path";

import config from "config";
import { Message } from "node-telegram-bot-api";

import { BotConfig } from "@config";
import UsersRepository from "@repositories/users";
import { hasBirthdayToday, isIsoDateString, MINUTE } from "@utils/date";
import { OptionalParam, userLink } from "@hackembot/core/helpers";
import { Admins, FeatureFlag, Route, UserRoles } from "@hackembot/core/decorators";

import HackerEmbassyBot from "../core/classes/HackerEmbassyBot";
import { ButtonFlags, InlineButton } from "../core/inlineButtons";
import t from "../core/localization";
import { RateLimiter } from "../core/classes/RateLimit";
import { BotController } from "../core/types";
import * as TextGenerators from "../text";

const botConfig = config.get<BotConfig>("bot");

const baseWishesDir = "./resources/wishes";

export default class BirthdayController implements BotController {
    @Route(["birthdays", "birthday"])
    @FeatureFlag("birthday")
    static async birthdayHandler(bot: HackerEmbassyBot, msg: Message) {
        const usersWithBirthday = UsersRepository.getUsers().filter(u => u.birthday);
        const text = TextGenerators.getBirthdaysList(usersWithBirthday, bot.context(msg).mode);

        const inline_keyboard = [[InlineButton(t("general.buttons.menu"), "startpanel", ButtonFlags.Editing)]];

        await bot.sendOrEditMessage(
            msg.chat.id,
            text,
            msg,
            {
                reply_markup: {
                    inline_keyboard,
                },
            },
            msg.message_id
        );
    }

    @Route(["mybirthday", "mybday", "bday"], OptionalParam(/(.*\S)/), match => [match[1]])
    @FeatureFlag("birthday")
    static myBirthdayHandler(bot: HackerEmbassyBot, msg: Message, input?: string) {
        const sender = bot.context(msg).user;

        if (input === "remove" && UsersRepository.updateUser(sender.userid, { birthday: null }))
            return bot.sendMessageExt(msg.chat.id, t("birthday.remove", { username: userLink(sender) }), msg);

        const fulldate = input?.length === 5 ? "0000-" + input : input;

        if (isIsoDateString(input) && UsersRepository.updateUser(sender.userid, { birthday: fulldate }))
            return bot.sendMessageExt(msg.chat.id, t("birthday.set", { username: userLink(sender), date: input }), msg);

        return bot.sendMessageExt(msg.chat.id, t("birthday.fail"), msg);
    }

    @Route(["sendwishes"])
    @FeatureFlag("birthday")
    @UserRoles(Admins)
    static async sendBirthdayWishes(bot: HackerEmbassyBot, msg: Nullable<Message>) {
        const birthdayUsers = UsersRepository.getUsers().filter(u => u.username && hasBirthdayToday(u.birthday));

        if (birthdayUsers.length === 0) return;

        await RateLimiter.executeOverTime(
            birthdayUsers.map(
                u => async () =>
                    bot.sendMessageExt(botConfig.chats.main, await getWish(u.username ?? "[no username provided]"), msg)
            ),
            MINUTE
        );
    }
}

async function getWish(username: string) {
    const files = await fs.readdir(baseWishesDir);
    const randomNum = Math.floor(Math.random() * files.length);
    const wishTemplate = await fs.readFile(path.join(baseWishesDir, files[randomNum]), { encoding: "utf8" });
    const persomalizedWish = wishTemplate.replaceAll(/\$username/g, `@${username}`);

    // Cake is a lie
    return `🎂 ${persomalizedWish}`;
}
