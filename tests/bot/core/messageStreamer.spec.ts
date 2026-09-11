/* eslint-disable @typescript-eslint/no-unused-vars */
import { Message } from "node-telegram-bot-api";

import MessageStreamer, { MessageStreamCallbacks } from "@hackembot/core/classes/MessageStreamer";
import { MAX_MESSAGE_LENGTH, MAX_STREAMING_WINDOW, ZERO_WIDTH_SPACE } from "@hackembot/core/constants";
import { MessageStreamingError } from "@hackembot/core/errors";
import { DeltaObject, DeltaStream } from "@services/neural/openwebui";

function fakeMessage(id: number): Message {
    return { message_id: id, date: 0, chat: { id: 1, type: "private" } };
}

async function* streamOf(chunks: DeltaObject[]): DeltaStream {
    for (const chunk of chunks) yield await Promise.resolve(chunk);
}

// Records every send/edit call for assertions, and hands out a fresh fake Message per sendText.
function createCallbacks() {
    let nextId = 0;
    const onTyping = jest.fn();
    const sendText = jest.fn((_text: string, _parseMode: "GFM" | "") => Promise.resolve(fakeMessage(++nextId)));
    const editText = jest.fn((_text: string, target: Message, _parseMode: "GFM" | "") => Promise.resolve(target));

    return { onTyping, sendText, editText } satisfies MessageStreamCallbacks;
}

describe("MessageStreamer.sendStreamedMessage", () => {
    it("signals typing once and sends the streamed text as a new message when it fits in one", async () => {
        const streamer = new MessageStreamer();
        const callbacks = createCallbacks();

        const result = await streamer.sendStreamedMessage(streamOf([{ response: "hello", done: true }]), "", callbacks);

        expect(callbacks.onTyping).toHaveBeenCalledTimes(1);
        expect(callbacks.sendText).toHaveBeenCalledTimes(1);
        expect(callbacks.sendText).toHaveBeenCalledWith("hello", "");
        expect(callbacks.editText).not.toHaveBeenCalled();
        expect(result).toEqual({ message: fakeMessage(1), text: "hello" });
    });

    it("skips chunks that carry no response and no scope change", async () => {
        const streamer = new MessageStreamer();
        const callbacks = createCallbacks();

        await streamer.sendStreamedMessage(streamOf([{ done: false }, { response: "hi", done: true }]), "", callbacks);

        expect(callbacks.sendText).toHaveBeenCalledTimes(1);
        expect(callbacks.sendText).toHaveBeenCalledWith("hi", "");
    });

    it("wraps a scoped run of chunks with start/end markers", async () => {
        const streamer = new MessageStreamer();
        const callbacks = createCallbacks();

        const result = await streamer.sendStreamedMessage(
            streamOf([
                { response: "a", scope: "thinking", done: false },
                { response: "b", done: true },
            ]),
            "",
            callbacks
        );

        expect(callbacks.sendText).toHaveBeenCalledWith("[thinking]\na", "");
        expect(callbacks.editText).toHaveBeenCalledWith(`[thinking]\na\n[/${ZERO_WIDTH_SPACE}thinking]\n\nb`, fakeMessage(1), "");
        expect(result?.text).toBe(`[thinking]\na\n[/${ZERO_WIDTH_SPACE}thinking]\n\nb`);
    });

    it("edits the message in place once the window fills, without truncating the buffer", async () => {
        const streamer = new MessageStreamer();
        const callbacks = createCallbacks();
        const filler = "x".repeat(MAX_STREAMING_WINDOW);

        const result = await streamer.sendStreamedMessage(
            streamOf([
                { response: "a", done: false },
                { response: filler, done: false },
                { response: " done", done: true },
            ]),
            "",
            callbacks
        );

        expect(callbacks.sendText).toHaveBeenCalledTimes(1);
        expect(callbacks.editText).toHaveBeenCalledTimes(2);
        expect(callbacks.editText).toHaveBeenNthCalledWith(1, "a" + filler, fakeMessage(1), "");
        expect(callbacks.editText).toHaveBeenNthCalledWith(2, "a" + filler + " done", fakeMessage(1), "");
        expect(result).toEqual({ message: fakeMessage(1), text: "a" + filler + " done" });
    });

    it("splits into a trailing new message once the buffer exceeds MAX_MESSAGE_LENGTH", async () => {
        const streamer = new MessageStreamer();
        const callbacks = createCallbacks();
        const overflow = "y".repeat(MAX_MESSAGE_LENGTH + 10);

        const result = await streamer.sendStreamedMessage(
            streamOf([
                { response: "a", done: false },
                { response: overflow, done: true },
            ]),
            "",
            callbacks
        );

        const combined = "a" + overflow;
        expect(callbacks.sendText).toHaveBeenCalledTimes(2);
        expect(callbacks.editText).toHaveBeenCalledTimes(1);
        expect(callbacks.editText).toHaveBeenCalledWith(combined.slice(0, MAX_MESSAGE_LENGTH), fakeMessage(1), "");
        expect(callbacks.sendText).toHaveBeenNthCalledWith(2, combined.slice(MAX_MESSAGE_LENGTH), "");
        expect(result).toEqual({ message: fakeMessage(2), text: combined });
    });

    it("retries once as plain text when the GFM send fails, then keeps using GFM going forward", async () => {
        const streamer = new MessageStreamer();
        const sendText = jest
            .fn<Promise<Nullable<Message>>, [string, "GFM" | ""]>()
            .mockImplementationOnce(() => {
                throw new Error("Telegram rejected the markdown");
            })
            .mockImplementation((_text, _parseMode) => Promise.resolve(fakeMessage(1)));
        const callbacks: MessageStreamCallbacks = { onTyping: jest.fn(), sendText, editText: jest.fn() };

        const result = await streamer.sendStreamedMessage(streamOf([{ response: "hi", done: true }]), "GFM", callbacks);

        expect(sendText).toHaveBeenNthCalledWith(1, "hi", "GFM");
        expect(sendText).toHaveBeenNthCalledWith(2, "hi", "");
        expect(result?.message).toEqual(fakeMessage(1));
    });

    it("rethrows a MessageStreamingError from the stream without sending anything", async () => {
        const streamer = new MessageStreamer();
        const callbacks = createCallbacks();

        await expect(
            streamer.sendStreamedMessage(streamOf([{ error: "model unavailable", done: true }]), "", callbacks)
        ).rejects.toBeInstanceOf(MessageStreamingError);

        expect(callbacks.sendText).not.toHaveBeenCalled();
    });

    it("swallows an unexpected error from a callback and resolves to null", async () => {
        const streamer = new MessageStreamer();
        const callbacks: MessageStreamCallbacks = {
            onTyping: jest.fn(),
            sendText: jest.fn(() => {
                throw new Error("network down");
            }),
            editText: jest.fn(),
        };

        const result = await streamer.sendStreamedMessage(streamOf([{ response: "hi", done: true }]), "", callbacks);

        expect(result).toBeNull();
    });
});
