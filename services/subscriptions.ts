import { SubscriptionExtended } from "@models/Subscription";
import Topic from "@models/Topic";
import subscriptionsRepository from "@repositories/subscriptions";
import usersRepository from "@repositories/users";
import fundsRepository from "@repositories/funds";
import User from "@models/User";

const PseudoTopics = new Map([
    ["members", { id: -1, name: "members", description: "All current residents" }],
    ["debtors", { id: -2, name: "debtors", description: "Residents with unpaid monthly costs" }],
]);

class SubscriptionsService {
    public getTopic(topicname: string) {
        return PseudoTopics.get(topicname) ?? subscriptionsRepository.getTopicByName(topicname);
    }

    public getAllTopics() {
        return subscriptionsRepository.getTopics();
    }

    public addTopic(topic: Topic | Omit<Topic, "id">) {
        return PseudoTopics.has(topic.name) ? false : subscriptionsRepository.addTopic(topic.name, topic.description ?? "");
    }

    public deleteTopic(topic: Topic) {
        return PseudoTopics.has(topic.name) ? false : subscriptionsRepository.deleteTopic(topic.id);
    }

    public getSubscriptionsByTopic(topic: Topic) {
        const pseudoTopic = PseudoTopics.get(topic.name);

        if (!pseudoTopic) return subscriptionsRepository.getSubscriptionsByTopicId(topic.id, true) as SubscriptionExtended[];

        switch (pseudoTopic.name) {
            case "members":
                return usersRepository.getUsersByRole("member").map(this.userToSubscription);
            case "debtors":
                return this.getDebtors().map(this.userToSubscription);
            default:
                return [];
        }
    }

    public getSubscriptionsByUser(user: User) {
        return subscriptionsRepository.getSubscriptionsByUserId(user.userid as number, true) as SubscriptionExtended[];
    }

    public subscribe(user: User, topic: Topic) {
        return PseudoTopics.has(topic.name) ? false : subscriptionsRepository.addSubscription(user.userid as number, topic.id);
    }

    public unsubscribe(user: User, topic: Topic) {
        if (PseudoTopics.has(topic.name)) return false;

        const subscription = subscriptionsRepository.getSubscription(user.userid as number, topic.id);
        if (!subscription) return false;

        return subscriptionsRepository.deleteSubscription(subscription.id);
    }

    private getDebtors() {
        const fundName = fundsRepository.getLatestCosts()?.name;
        if (!fundName) return [];
        const donations = fundsRepository.getDonationsForName(fundName);
        const residents = usersRepository.getUsersByRole("member");

        return residents.filter(resident => donations.filter(d => d.username === resident.username).length === 0);
    }

    private userToSubscription(user: User) {
        return { userid: user.userid, username: user.username };
    }
}

export default new SubscriptionsService();
