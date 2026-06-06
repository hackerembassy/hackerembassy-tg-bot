export class MessageStreamingError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "MessageStreamingError";
    }
}
