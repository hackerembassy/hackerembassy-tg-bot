class State {
    id: number;
    open: boolean;
    changedby: string;
    date: number | Date;

    constructor({ id, open, changedby, date }) {
        this.id = id;
        this.open = open;
        this.changedby = changedby;
        this.date = date;
    }
}

export default State;
