class Fund {
    readonly id: number;
    name: string;
    target_value: number;
    target_currency: string;
    status: string;

    constructor({ id, name, target_value, target_currency, status = "open" }: Fund) {
        this.id = id;
        this.name = name;
        this.target_value = target_value;
        this.target_currency = target_currency;
        this.status = status;
    }
}

export default Fund;
