class Subscription {
    readonly id: number;
    userid: number;
    topicid: number;

    constructor({ id, userid, topicid }: Subscription) {
        this.id = id;
        this.userid = userid;
        this.topicid = topicid;
    }
}

export class SubscriptionExtended extends Subscription {
    topicname?: string;
    topicdescription?: string;
    username?: string;

    constructor({ id, userid, topicid, topicname, topicdescription, username }: SubscriptionExtended) {
        super({ id, userid, topicid });
        this.topicname = topicname;
        this.topicdescription = topicdescription;
        this.username = username;
    }
}

export default Subscription;
