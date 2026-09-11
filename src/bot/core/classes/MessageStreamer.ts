import { Message } from "node-telegram-bot-api";

import logger from "@services/common/logger";
import { DeltaStream } from "@services/neural/openwebui";

import { chunkSubstr } from "@utils/text";

import { MAX_MESSAGE_LENGTH, MAX_STREAMING_WINDOW, ZERO_WIDTH_SPACE } from "../constants";
import { MessageStreamingError } from "../errors";

// Everything this needs from the caller, kept as plain callbacks rather than a bot-shaped
// interface - this class only orchestrates "type, then send/edit text as chunks arrive
// respecting length limits and scope markers", it doesn't need to know what a chat, a message
// send, or a message edit actually look like beyond these three operations.
export interface MessageStreamCallbacks {
    onTyping: () => void;
    sendText: (text: string, parseMode: "GFM" | "") => Promise<Nullable<Message>>;
    editText: (text: string, target: Message, parseMode: "GFM" | "") => Promise<boolean | Message>;
}

// Streams AI responses by editing one message in place as chunks arrive, splitting into
// additional messages only once the streamed content grows past MAX_MESSAGE_LENGTH. Kept
// separate from HackerEmbassyBot since it's only relevant to AI/streaming callers and has none
// of the routing/messaging-extension concerns they share.
export default class MessageStreamer {
    public async sendStreamedMessage(
        stream: DeltaStream,
        parseMode: "GFM" | "",
        callbacks: MessageStreamCallbacks
    ): Promise<Nullable<{ message: Message; text: string }>> {
        callbacks.onTyping();

        let messageToEdit: Nullable<Message> = null;
        let lastMessage: Nullable<Message> = null;
        let buffer = "";
        let fullText = "";
        let window = 0;
        let currentScope: string | null = null;

        try {
            for await (const chunk of stream) {
                if (chunk.error) {
                    throw new MessageStreamingError(chunk.error);
                }

                const scopeTransition = this.resolveScopeTransition(chunk.scope, currentScope);
                currentScope = scopeTransition.currentScope;
                buffer += scopeTransition.header;
                fullText += scopeTransition.header;
                window += scopeTransition.header.length;

                if (chunk.response) {
                    buffer += chunk.response;
                    fullText += chunk.response;
                    window += chunk.response.length;
                }

                // Skip empty chunks
                if (buffer.length === 0) continue;

                if (!messageToEdit) {
                    messageToEdit = await this.withPlainTextFallback(chunk.done ? parseMode : "", pm =>
                        callbacks.sendText(buffer, pm)
                    );
                    lastMessage = messageToEdit;
                } else if (chunk.done || window >= MAX_STREAMING_WINDOW) {
                    // A length-driven cut can (and for long code-bearing replies, will) sever an open
                    // "**bold" or an unclosed code fence if done at an arbitrary character offset - so it's
                    // aligned to the last newline within budget instead, via the same chunkSubstr used for
                    // long non-streamed messages. GFMToTelegramMarkdown confines every entity except fenced
                    // code blocks to a single line, so that's enough to safely format the segment being
                    // closed out, not just the true final one (chunk.done). Splitting applies on chunk.done
                    // too - a final flush can itself land over the limit, and unlike a mid-stream rollover
                    // there's no next iteration to send the rest, so every leftover segment is flushed here.
                    const overLength = buffer.length > MAX_MESSAGE_LENGTH;
                    const [segment, ...rest] = overLength ? chunkSubstr(buffer, MAX_MESSAGE_LENGTH) : [buffer];
                    const editTarget = messageToEdit;

                    // Close an open scope here and reopen it below, so a cut mid-scope never leaves
                    // one message with no closing tag and the next with no opening tag.
                    const closedSegment =
                        overLength && currentScope ? `${segment}\n[/${ZERO_WIDTH_SPACE}${currentScope}]\n\n` : segment;

                    await this.withPlainTextFallback(chunk.done || overLength ? parseMode : "", pm =>
                        callbacks.editText(closedSegment, editTarget, pm)
                    );

                    if (chunk.done) {
                        for (const trailingSegment of rest) {
                            lastMessage = await this.withPlainTextFallback(parseMode, pm =>
                                callbacks.sendText(trailingSegment, pm)
                            );
                        }
                    } else if (overLength) {
                        messageToEdit = null;
                        buffer = (currentScope ? `[${currentScope}]\n` : "") + rest.join("");
                    }

                    window = 0;
                }
            }

            return lastMessage ? { message: lastMessage, text: fullText } : null;
        } catch (error) {
            if (error instanceof MessageStreamingError) {
                throw error;
            }
            logger.error(error);
            return null;
        }
    }

    // A scope groups a run of chunks under a "[scope]...[/scope]" header/footer pair (e.g. a
    // "thinking" block) - this fires once when a scope starts or ends, returning the marker text
    // to append (empty when neither) and the scope to carry into the next chunk.
    private resolveScopeTransition(
        chunkScope: string | undefined,
        currentScope: string | null
    ): { header: string; currentScope: string | null } {
        if (chunkScope && !currentScope) {
            return { header: `[${chunkScope}]\n`, currentScope: chunkScope };
        }

        if (!chunkScope && currentScope) {
            return { header: `\n[/${ZERO_WIDTH_SPACE}${currentScope}]\n\n`, currentScope: null };
        }

        return { header: "", currentScope };
    }

    // Telegram's MarkdownV2 parser is strict and will reject the whole send/edit if the converted
    // entities are malformed - rare given how defensive GFMToTelegramMarkdown is, but streamed AI output
    // is unpredictable enough that it shouldn't be allowed to abort an otherwise-working response. Retries
    // once as plain text instead of letting the error propagate; a plain-text failure is a real problem
    // (network, bad chat id, etc.) and still propagates to the caller as before.
    private async withPlainTextFallback<T>(parseMode: "GFM" | "", attempt: (parseMode: "GFM" | "") => Promise<T>): Promise<T> {
        try {
            return await attempt(parseMode);
        } catch (error) {
            if (parseMode !== "GFM") throw error;
            logger.warn(error);
            return await attempt("");
        }
    }
}
