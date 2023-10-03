class Donation {
    readonly id: number;
    username: string;
    fund_id: number;
    value: number;
    currency: string;
    accountant: string;

    constructor({ id, username, fund_id, value, currency, accountant }: Donation) {
        this.id = id;
        this.username = username;
        this.fund_id = fund_id;
        this.value = value;
        this.currency = currency;
        this.accountant = accountant;
    }
}

export class FundDonation {
    username: string;
    value: number;
    currency: string;
    name: string;

    constructor({ name, username, value, currency }: FundDonation) {
        this.name = name;
        this.username = username;
        this.value = value;
        this.currency = currency;
    }
}

export default Donation;
