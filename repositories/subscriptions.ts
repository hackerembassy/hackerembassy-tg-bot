import Subscription, { SubscriptionExtended } from "@models/Subscription";
import Topic from "@models/Topic";

import BaseRepository from "./base";

class SubscriptionsRepository extends BaseRepository {
    getTopics(): Topic[] {
        return this.db.prepare("SELECT * FROM topics").all() as Topic[];
    }
    getTopicById(id: number): Nullable<Topic> {
        return this.db.prepare("SELECT * FROM topics where id=?").get(id) as Topic;
    }
    getTopicByName(name: string): Nullable<Topic> {
        return this.db.prepare("SELECT * FROM topics where name=?").get(name) as Topic;
    }

    getSubscriptionsByUserId(userId: number, joinTopic: boolean = false): Subscription[] | SubscriptionExtended[] {
        return joinTopic
            ? (this.db
                  .prepare(
                      "SELECT s.id, s.userid, s.topicid, t.name as topicname, t.description as topicdescription FROM subscriptions s JOIN topics t ON t.id = s.topicid where s.userid=?"
                  )
                  .all(userId) as SubscriptionExtended[])
            : (this.db.prepare("SELECT * FROM subscriptions where userid=?").all(userId) as Subscription[]);
    }
    getSubscriptionsByTopicId(topicId: number, joinUser: boolean = false): Subscription[] | SubscriptionExtended[] {
        return joinUser
            ? (this.db
                  .prepare(
                      "SELECT s.id, s.userid, s.topicid, u.username as username FROM subscriptions s JOIN users u ON u.userid = s.userid where s.topicid=?"
                  )
                  .all(topicId) as Subscription[])
            : (this.db.prepare("SELECT * FROM subscriptions where topicid=?").all(topicId) as Subscription[]);
    }
    getSubscription(userid: number, topicid: number): Nullable<Subscription> {
        return this.db.prepare("SELECT * FROM subscriptions where userid=? and topicid=?").get(userid, topicid) as Subscription;
    }

    addSubscription(userId: number, topicId: number): boolean {
        try {
            this.db.prepare("INSERT INTO subscriptions (id, userid, topicid) VALUES (NULL, ?, ?)").run(userId, topicId);
            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    addTopic(name: string, description: string): boolean {
        try {
            this.db.prepare("INSERT INTO topics (id, name, description) VALUES (NULL, ?, ?)").run(name, description);
            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    deleteSubscription(id: number): boolean {
        try {
            this.db.prepare("DELETE FROM subscriptions WHERE id=?").run(id);
            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }

    deleteTopic(id: number): boolean {
        try {
            this.db.prepare("DELETE FROM topics WHERE id=?").run(id);
            return true;
        } catch (error) {
            this.logger.error(error);
            return false;
        }
    }
}

export default new SubscriptionsRepository();
