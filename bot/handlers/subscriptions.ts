import { Message } from "node-telegram-bot-api";

import { Topic } from "@data/models";

import logger from "@services/logger";
import SubscriptionsService from "@services/subscriptions";

import HackerEmbassyBot from "../core/HackerEmbassyBot";
import { ButtonFlags, InlineButton } from "../core/InlineButtons";
import t from "../core/localization";
import { DEFAULT_NOTIFICATIONS_RATE_LIMIT, RateLimiter } from "../core/RateLimit";
import { BotHandlers } from "../core/types";
import { userLink } from "../core/helpers";
import { listTopics } from "../textGenerators";

export default class TopicsHandlers implements BotHandlers {
    static async mySubscriptionsHandler(bot: HackerEmbassyBot, msg: Message) {
        try {
            const subscriptions = SubscriptionsService.getSubscriptionsByUser(bot.context(msg).user);

            if (!subscriptions.length) {
                await bot.sendMessageExt(msg.chat.id, t("topics.subscriptions.empty"), msg);
                return;
            }

            const topics = listTopics(
                subscriptions.map(
                    subscription =>
                        ({
                            id: subscription.topic_id,
                            name: subscription.topic.name,
                            description: subscription.topic.description,
                        }) as Topic
                )
            );

            const inline_keyboard = [
                [
                    InlineButton(t("topics.buttons.topics"), "topics", ButtonFlags.Editing),
                    InlineButton(t("general.buttons.menu"), "startpanel", ButtonFlags.Editing),
                ],
            ];

            await bot.sendOrEditMessage(
                msg.chat.id,
                t("topics.subscriptions.list", { topics }),
                msg,
                {
                    reply_markup: {
                        inline_keyboard,
                    },
                },
                msg.message_id
            );
        } catch (error) {
            await bot.sendMessageExt(msg.chat.id, t("topics.general.error"), msg);
            logger.error(error);
        }
    }

    static tagSubscribersHandler(bot: HackerEmbassyBot, msg: Message, topicname: string) {
        try {
            const topic = SubscriptionsService.getTopic(topicname);

            if (!topic) return bot.sendMessageExt(msg.chat.id, t("topics.general.notfound", { topic: topicname }), msg);

            const subscriptions = SubscriptionsService.getSubscriptionsByTopic(topic);

            if (!subscriptions.length)
                return bot.sendMessageExt(msg.chat.id, t("topics.general.nosubscribers", { topic: topicname }), msg);

            const text = subscriptions
                .map(subscription =>
                    subscription.user.username
                        ? `@${subscription.user.username}`
                        : userLink({ username: "anon", id: subscription.user_id })
                )
                .join(" ");

            return bot.sendMessageExt(msg.chat.id, text, msg);
        } catch (error) {
            logger.error(error);
            return bot.sendMessageExt(msg.chat.id, t("topics.general.error"), msg);
        }
    }

    static async notifySubscribersHandler(bot: HackerEmbassyBot, msg: Message, topicname: string, text: string) {
        try {
            if (!topicname || !text) {
                await bot.sendMessageExt(msg.chat.id, t("topics.notify.help"), msg);
                return;
            }

            const topic = SubscriptionsService.getTopic(topicname);

            if (!topic) {
                await bot.sendMessageExt(msg.chat.id, t("topics.general.notfound", { topic: topicname }), msg);
                return;
            }

            const subscriptions = SubscriptionsService.getSubscriptionsByTopic(topic);

            if (!subscriptions.length) {
                await bot.sendMessageExt(msg.chat.id, t("topics.general.nosubscribers", { topic: topicname }), msg);
                return;
            }

            const count = subscriptions.length;

            await bot.sendMessageExt(
                msg.chat.id,
                t("topics.notify.started", {
                    topic: topicname,
                    count,
                    eta: (subscriptions.length * DEFAULT_NOTIFICATIONS_RATE_LIMIT) / 1000,
                }),
                msg
            );

            // Save the message thread id to be able to reply to the original topic later
            const context = bot.context(msg);
            const topicId = context.messageThreadId;
            context.messageThreadId = undefined;

            const message = t("topics.notify.message", { topic: topicname, text });

            const results = await RateLimiter.executeOverTime(
                subscriptions.map(s => () => bot.sendMessageExt(s.user_id, message, msg)),
                DEFAULT_NOTIFICATIONS_RATE_LIMIT,
                error => {
                    logger.error(error);
                    return null;
                }
            );

            const received = results.filter(r => r !== null).length;

            context.messageThreadId = topicId;

            await bot.sendMessageExt(msg.chat.id, t("topics.notify.finished", { topic: topicname, count, received }), msg);
        } catch (error) {
            await bot.sendMessageExt(msg.chat.id, t("topics.general.error"), msg);
            logger.error(error);
        }
    }

    static async topicsHandler(bot: HackerEmbassyBot, msg: Message) {
        try {
            const isMember = bot.context(msg).user.roles?.includes("member");
            const topics = SubscriptionsService.getAllTopics();
            const topicsList = topics.length > 0 ? listTopics(topics) : t("topics.general.empty");
            const text = t("topics.topics.list", { topics: topicsList }) + (isMember ? `\n${t("topics.topics.member")}` : "");

            const inline_keyboard = [
                [
                    InlineButton(t("topics.buttons.subscriptions"), "subscriptions", ButtonFlags.Editing),
                    InlineButton(t("general.buttons.menu"), "startpanel", ButtonFlags.Editing),
                ],
            ];

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
        } catch (error) {
            await bot.sendMessageExt(msg.chat.id, t("topics.general.error"), msg);
            logger.error(error);
        }
    }

    static async addTopicHandler(bot: HackerEmbassyBot, msg: Message, topicname: string, topicdescription: string) {
        try {
            if (SubscriptionsService.getTopic(topicname)) {
                await bot.sendMessageExt(msg.chat.id, t("topics.add.exists", { topic: topicname }), msg);
                return;
            }

            const success = SubscriptionsService.addTopic({ name: topicname, description: topicdescription });

            if (!success) throw new Error("Failed to add topic");

            await bot.sendMessageExt(msg.chat.id, t("topics.add.success", { topic: topicname }), msg);
        } catch (error) {
            await bot.sendMessageExt(msg.chat.id, t("topics.add.fail", { topic: topicname }), msg);
            logger.error(error);
        }
    }

    static async deleteTopicHandler(bot: HackerEmbassyBot, msg: Message, topicname: string) {
        try {
            const topic = SubscriptionsService.getTopic(topicname);

            if (!topic) {
                await bot.sendMessageExt(msg.chat.id, t("topics.general.notfound", { topic: topicname }), msg);
                return;
            }

            const success = SubscriptionsService.deleteTopic(topic);

            if (!success) throw new Error("Failed to delete topic");

            await bot.sendMessageExt(msg.chat.id, t("topics.delete.success", { topic: topicname }), msg);
        } catch (error) {
            await bot.sendMessageExt(msg.chat.id, t("topics.delete.fail", { topic: topicname }), msg);
            logger.error(error);
        }
    }

    static subscribeHandler(bot: HackerEmbassyBot, msg: Message, topicname: string) {
        try {
            const sender = bot.context(msg).user;
            const topic = SubscriptionsService.getTopic(topicname);

            if (!topic) return bot.sendMessageExt(msg.chat.id, t("topics.general.notfound", { topic: topicname }), msg);

            if (SubscriptionsService.getSubscriptionsByTopic(topic).some(s => s.user_id === sender.userid))
                return bot.sendMessageExt(msg.chat.id, t("topics.subscribe.already", { topic: topicname }), msg);

            if (!SubscriptionsService.subscribe(sender, topic)) throw new Error("Failed to subscribe user");

            return bot.sendMessageExt(msg.chat.id, t("topics.subscribe.success", { topic: topicname }), msg);
        } catch (error) {
            logger.error(error);
            return bot.sendMessageExt(msg.chat.id, t("topics.subscribe.fail", { topic: topicname }), msg);
        }
    }

    static unsubscribeHandler(bot: HackerEmbassyBot, msg: Message, topicname: string) {
        try {
            const sender = bot.context(msg).user;
            const topic = SubscriptionsService.getTopic(topicname);

            if (!topic) return bot.sendMessageExt(msg.chat.id, t("topics.general.notfound", { topic: topicname }), msg);

            if (!SubscriptionsService.unsubscribe(sender, topic)) throw new Error("Failed to unsubscribe user");

            return bot.sendMessageExt(msg.chat.id, t("topics.unsubscribe.success", { topic: topicname }), msg);
        } catch (error) {
            logger.error(error);
            return bot.sendMessageExt(msg.chat.id, t("topics.unsubscribe.fail", { topic: topicname }), msg);
        }
    }
}
