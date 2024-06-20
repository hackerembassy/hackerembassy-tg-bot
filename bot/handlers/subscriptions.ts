import { Message } from "node-telegram-bot-api";

import { SubscriptionExtended } from "@models/Subscription";
import Topic from "@models/Topic";
import subscriptionsRepository from "@repositories/subscriptions";
import logger from "@services/logger";

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
            const tgUserId = msg.from?.id as number;
            const subscriptions = subscriptionsRepository.getSubscriptionsByUserId(tgUserId, true) as SubscriptionExtended[];

            if (!subscriptions.length) {
                await bot.sendMessageExt(msg.chat.id, t("topics.subscriptions.empty"), msg);
                return;
            }

            const topics = listTopics(
                subscriptions.map(
                    subscription =>
                        ({
                            id: subscription.topicid,
                            name: subscription.topicname,
                            description: subscription.topicdescription,
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
            const topic = subscriptionsRepository.getTopicByName(topicname);

            if (!topic) {
                bot.sendMessageExt(msg.chat.id, t("topics.general.notfound", { topic: topicname }), msg);
                return;
            }

            const subscriptions = subscriptionsRepository.getSubscriptionsByTopicId(topic.id, true) as SubscriptionExtended[];

            if (!subscriptions.length) {
                bot.sendMessageExt(msg.chat.id, t("topics.general.nosubscribers", { topic: topicname }), msg);
                return;
            }

            const text = subscriptions
                .map(subscription =>
                    subscription.username ? `@${subscription.username}` : userLink({ username: "anon", id: subscription.userid })
                )
                .join(" ");

            bot.sendMessageExt(msg.chat.id, text, msg);
        } catch (error) {
            bot.sendMessageExt(msg.chat.id, t("topics.general.error"), msg);
            logger.error(error);
        }
    }

    static async notifySubscribersHandler(bot: HackerEmbassyBot, msg: Message, topicname: string, text: string) {
        try {
            if (!topicname || !text) {
                await bot.sendMessageExt(msg.chat.id, t("topics.notify.help"), msg);
                return;
            }

            const topic = subscriptionsRepository.getTopicByName(topicname);

            if (!topic) {
                await bot.sendMessageExt(msg.chat.id, t("topics.general.notfound", { topic: topicname }), msg);
                return;
            }

            const subscriptions = subscriptionsRepository.getSubscriptionsByTopicId(topic.id, true) as SubscriptionExtended[];

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
                subscriptions.map(s => () => bot.sendMessageExt(s.userid, message, msg)),
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
            const isMember = bot.context(msg).user?.hasRole("member");
            const topics = subscriptionsRepository.getTopics();
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
            if (subscriptionsRepository.getTopicByName(topicname)) {
                await bot.sendMessageExt(msg.chat.id, t("topics.add.exists", { topic: topicname }), msg);
                return;
            }

            const success = subscriptionsRepository.addTopic(topicname, topicdescription);

            if (!success) throw new Error("Failed to add topic");

            await bot.sendMessageExt(msg.chat.id, t("topics.add.success", { topic: topicname }), msg);
        } catch (error) {
            await bot.sendMessageExt(msg.chat.id, t("topics.add.fail", { topic: topicname }), msg);
            logger.error(error);
        }
    }

    static async deleteTopicHandler(bot: HackerEmbassyBot, msg: Message, topicname: string) {
        try {
            const topic = subscriptionsRepository.getTopicByName(topicname);

            if (!topic) {
                await bot.sendMessageExt(msg.chat.id, t("topics.general.notfound", { topic: topicname }), msg);
                return;
            }

            const success = subscriptionsRepository.deleteTopic(topic.id);

            if (!success) throw new Error("Failed to delete topic");

            await bot.sendMessageExt(msg.chat.id, t("topics.delete.success", { topic: topicname }), msg);
        } catch (error) {
            await bot.sendMessageExt(msg.chat.id, t("topics.delete.fail", { topic: topicname }), msg);
            logger.error(error);
        }
    }

    static async subscribeHandler(bot: HackerEmbassyBot, msg: Message, topicname: string) {
        try {
            const tgUserId = msg.from?.id as number;
            const topic = subscriptionsRepository.getTopicByName(topicname);

            if (!topic) {
                await bot.sendMessageExt(msg.chat.id, t("topics.general.notfound", { topic: topicname }), msg);
                return;
            }

            if (subscriptionsRepository.getSubscriptionsByTopicId(topic.id).some(s => s.userid === tgUserId)) {
                await bot.sendMessageExt(msg.chat.id, t("topics.subscribe.already", { topic: topicname }), msg);
                return;
            }

            const success = subscriptionsRepository.addSubscription(tgUserId, topic.id);

            if (!success) throw new Error("Failed to subscribe user");

            await bot.sendMessageExt(msg.chat.id, t("topics.subscribe.success", { topic: topicname }), msg);
        } catch (error) {
            await bot.sendMessageExt(msg.chat.id, t("topics.subscribe.fail", { topic: topicname }), msg);
            logger.error(error);
        }
    }

    static async unsubscribeHandler(bot: HackerEmbassyBot, msg: Message, topicname: string) {
        try {
            const tgUserId = msg.from?.id as number;
            const topic = subscriptionsRepository.getTopicByName(topicname);

            if (!topic) {
                await bot.sendMessageExt(msg.chat.id, t("topics.general.notfound", { topic: topicname }), msg);
                return;
            }

            const subscription = subscriptionsRepository.getSubscription(tgUserId, topic.id);

            if (!subscription) {
                await bot.sendMessageExt(msg.chat.id, t("topics.unsubscribe.notsubscribed", { topic: topicname }), msg);
                return;
            }

            const success = subscriptionsRepository.deleteSubscription(subscription.id);

            if (!success) throw new Error("Failed to unsubscribe user");

            await bot.sendMessageExt(msg.chat.id, t("topics.unsubscribe.success", { topic: topicname }), msg);
        } catch (error) {
            await bot.sendMessageExt(msg.chat.id, t("topics.unsubscribe.fail", { topic: topicname }), msg);
            logger.error(error);
        }
    }
}
