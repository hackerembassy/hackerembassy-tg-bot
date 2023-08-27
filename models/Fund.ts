class Fund {
    id: any;
    name: any;
    target_value: any;
    target_currency: any;
    status: string;

    constructor({ id, name, target_value, target_currency, status = "open" }) {
        this.id = id;
        this.name = name;
        this.target_value = target_value;
        this.target_currency = target_currency;
        this.status = status;
    }
}

export default Fund;
