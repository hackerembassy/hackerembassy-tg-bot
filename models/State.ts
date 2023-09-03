class State {
    readonly id: number;
    open: boolean;
    changedby: string;
    date: number | Date;

    constructor(id: number, open: boolean, changedby: string, date: number | Date) {
        this.id = id;
        this.open = open;
        this.changedby = changedby;
        this.date = date;
    }
}

export default State;
