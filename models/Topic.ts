class Topic {
    readonly id: number;
    name: string;
    description: Nullable<string>;

    constructor({ id, name, description = null }: Topic) {
        this.id = id;
        this.name = name;
        this.description = description;
    }
}

export default Topic;
