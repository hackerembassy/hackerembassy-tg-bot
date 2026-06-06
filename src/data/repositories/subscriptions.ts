import { and, eq } from "drizzle-orm";

import { subscriptions, topics } from "@data/schema";

import BaseRepository from "./base";

class SubscriptionsRepository extends BaseRepository {
    getTopics() {
        return this.db.select().from(topics).all();
    }

    getTopicById(id: number) {
        return this.db.select().from(topics).where(eq(topics.id, id)).get();
    }

    getTopicByName(name: string) {
        return this.db.select().from(topics).where(eq(topics.name, name)).get();
    }

    getSubscriptionsByUserId(userId: number, joinTopic: boolean = false) {
        return this.db.query.subscriptions
            .findMany({
                where: eq(subscriptions.user_id, userId),
                with: {
                    topic: joinTopic ? true : undefined,
                },
            })
            .sync();
    }

    getSubscriptionsByTopicId(topicId: number, joinUser: boolean = false) {
        return this.db.query.subscriptions
            .findMany({
                where: eq(subscriptions.topic_id, topicId),
                with: {
                    user: joinUser ? true : undefined,
                },
            })
            .sync();
    }
    getSubscription(userid: number, topicid: number) {
        return this.db
            .select()
            .from(subscriptions)
            .where(and(eq(subscriptions.user_id, userid), eq(subscriptions.topic_id, topicid)))
            .get();
    }

    addSubscription(userId: number, topicId: number): boolean {
        return this.db.insert(subscriptions).values({ user_id: userId, topic_id: topicId }).run().changes > 0;
    }

    addTopic(name: string, description: string): boolean {
        return this.db.insert(topics).values({ name, description }).run().changes > 0;
    }

    deleteSubscription(id: number): boolean {
        return this.db.delete(subscriptions).where(eq(subscriptions.id, id)).run().changes > 0;
    }

    deleteTopic(id: number): boolean {
        return this.db.delete(topics).where(eq(topics.id, id)).run().changes > 0;
    }
}

export default new SubscriptionsRepository();
