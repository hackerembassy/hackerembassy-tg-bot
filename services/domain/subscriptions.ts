import { Topic, User } from "@data/models";

import subscriptionsRepository from "@repositories/subscriptions";
import usersRepository from "@repositories/users";
import fundsRepository from "@repositories/funds";

const PseudoTopics = new Map([
    ["members", { id: -1, name: "members", description: "All current residents" }],
    ["trusted", { id: -2, name: "trusted", description: "Guests with trusted status" }],
    ["accountants", { id: -3, name: "accountants", description: "Residents with accountant status" }],
    ["debtors", { id: -4, name: "debtors", description: "Residents with unpaid monthly costs" }],
]);

class SubscriptionsService {
    public getTopic(topicname: string) {
        return PseudoTopics.get(topicname) ?? subscriptionsRepository.getTopicByName(topicname);
    }

    public getPseudoTopics() {
        return Array.from(PseudoTopics.values());
    }

    public getAllTopics(includePseudo: boolean = false) {
        const actualTopics = subscriptionsRepository.getTopics();

        if (!includePseudo) return actualTopics;

        return [...actualTopics, ...this.getPseudoTopics()];
    }

    public addTopic(topic: Topic | Omit<Topic, "id">) {
        return PseudoTopics.has(topic.name) ? false : subscriptionsRepository.addTopic(topic.name, topic.description ?? "");
    }

    public deleteTopic(topic: Topic) {
        return PseudoTopics.has(topic.name) ? false : subscriptionsRepository.deleteTopic(topic.id);
    }

    public getSubscriptionsByTopic(topic: Topic) {
        const pseudoTopic = PseudoTopics.get(topic.name);

        if (!pseudoTopic) return subscriptionsRepository.getSubscriptionsByTopicId(topic.id, true);

        switch (pseudoTopic.name) {
            case "members":
                return usersRepository.getUsersByRole("member").map(this.userToSubscription);
            case "trusted":
                return usersRepository.getUsersByRole("trusted").map(this.userToSubscription);
            case "accountants":
                return usersRepository.getUsersByRole("accountant").map(this.userToSubscription);
            case "debtors":
                return this.getDebtors().map(this.userToSubscription);
            default:
                return [];
        }
    }

    public getSubscriptionsByUser(user: User) {
        return subscriptionsRepository.getSubscriptionsByUserId(user.userid, true);
    }

    public subscribe(user: User, topic: Topic) {
        return PseudoTopics.has(topic.name) ? false : subscriptionsRepository.addSubscription(user.userid, topic.id);
    }

    public unsubscribe(user: User, topic: Topic) {
        if (PseudoTopics.has(topic.name)) return false;

        const subscription = subscriptionsRepository.getSubscription(user.userid, topic.id);
        if (!subscription) return false;

        return subscriptionsRepository.deleteSubscription(subscription.id);
    }

    private getDebtors() {
        const fundName = fundsRepository.getLatestCosts()?.name;
        if (!fundName) return [];
        const donations = fundsRepository.getDonationsForName(fundName);
        const residents = usersRepository.getUsersByRole("member");

        return residents.filter(resident => donations.filter(d => d.user_id === resident.userid).length === 0);
    }

    private userToSubscription(user: User) {
        return { user_id: user.userid, username: user.username, user };
    }
}

export default new SubscriptionsService();
