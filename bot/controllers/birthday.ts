import fs from "fs/promises";
import path from "path";

import config from "config";
import { Message } from "node-telegram-bot-api";

import { BotConfig } from "@config";
import logger from "@services/common/logger";
import { userService } from "@services/domain/user";
import { hasBirthdayToday, hasBithdayThisMonth, isIsoDateString, MINUTE } from "@utils/date";

import { Route, FeatureFlag, UserRoles, Admins } from "../core/decorators";
import { OptionalParam, userLink } from "../core/helpers";
import HackerEmbassyBot from "../core/classes/HackerEmbassyBot";
import { ButtonFlags, InlineButton } from "../core/inlineButtons";
import t from "../core/localization";
import { RateLimiter } from "../core/classes/RateLimit";
import { BotController } from "../core/types";
import * as TextGenerators from "../text";

const botConfig = config.get<BotConfig>("bot");

export default class BirthdayController implements BotController {
    @Route(["birthdays", "birthday"], "List upcoming birthdays")
    @FeatureFlag("birthday")
    static async birthdayHandler(bot: HackerEmbassyBot, msg: Message) {
        const usersWithBirthday = userService.getUsersWithBirthdays().filter(u => u.username && hasBithdayThisMonth(u.birthday));
        const birthdayList = TextGenerators.getBirthdaysList(usersWithBirthday, bot.context(msg).mode);
        const text = `${t("birthday.nextbirthdays")}${birthdayList}\n\n${t("birthday.help")}`;

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

    @Route(["mybirthday", "mybday", "bday"], "Manage your birthday", OptionalParam(/(.*\S)/), match => [match[1]])
    @FeatureFlag("birthday")
    static myBirthdayHandler(bot: HackerEmbassyBot, msg: Message, input?: string) {
        try {
            const sender = bot.context(msg).user;

            if (input === "remove") {
                if (userService.setBithday(sender, null))
                    return bot.sendMessageExt(msg.chat.id, t("birthday.remove", { username: userLink(sender) }), msg);
                else throw new Error("Failed to remove birthday");
            }

            if (input && isIsoDateString(input)) {
                if (userService.setBithday(sender, input))
                    return bot.sendMessageExt(msg.chat.id, t("birthday.set", { username: userLink(sender), date: input }), msg);
                else throw new Error("Failed to set birthday");
            }

            const currentBirthday = sender.birthday ? sender.birthday.substring(5, 10) : null;

            return bot.sendMessageExt(
                msg.chat.id,
                `${currentBirthday ? t("birthday.current", { date: currentBirthday }) : t("birthday.notset")}\n\n${t("birthday.help")}`,
                msg
            );
        } catch (error) {
            logger.error(`Failed to set/get birthday for user ${bot.context(msg).user.userid}: ${(error as Error).message}`);
            logger.debug(error);

            return bot.sendMessageExt(msg.chat.id, t("birthday.fail"), msg);
        }
    }

    @Route(["sendwishes"], "Send birthday wishes", OptionalParam(/(\S+)(?: (\S+))?/), match => [match[1], match[2]])
    @FeatureFlag("birthday")
    @UserRoles(Admins)
    static async sendBirthdayWishes(bot: HackerEmbassyBot, msg: Nullable<Message>, username?: string, wishfilename?: string) {
        try {
            const birthdayTargetChat = botConfig.chats.main;
            const birthdayTodayUsers = username
                ? [userService.getUser(username)].filter(u => u !== undefined)
                : userService.getUsersWithBirthdays().filter(u => hasBirthdayToday(u.birthday));

            if (birthdayTodayUsers.length === 0) return;

            await RateLimiter.executeOverTime(
                birthdayTodayUsers.map(u => async () => {
                    const isMember = await bot.isChatMember(birthdayTargetChat, u.userid);

                    // Allow forcing a wish by username even if the user is not a member for testing purposes
                    if (!isMember && !username) {
                        logger.warn(`User ${u.username} [${u.userid}] is not a member of the main chat, skipping birthday wish`);
                        return Promise.resolve();
                    }

                    const wish = await getWish(u.username as string, wishfilename);

                    return bot.sendMessageExt(birthdayTargetChat, wish, msg);
                }),
                MINUTE
            );
        } catch (e) {
            logger.error(`Failed to send birthday wishes: ${(e as Error).message}`);
        }
    }
}

async function getWish(username: string, wishfilename?: string): Promise<string> {
    const baseWishesDir = "./resources/wishes";
    const files = await fs.readdir(baseWishesDir);
    const wishfile = wishfilename ? files.find(f => f === wishfilename) : files[Math.floor(Math.random() * files.length)];

    if (!wishfile) throw Error(`Wish file ${wishfilename} not found`);

    const wishTemplate = await fs.readFile(path.join(baseWishesDir, wishfile), { encoding: "utf8" });
    const persomalizedWish = wishTemplate.replaceAll(/\$username/g, `@${username}`);

    // Cake is a lie
    return `🎂 ${persomalizedWish}`;
}
