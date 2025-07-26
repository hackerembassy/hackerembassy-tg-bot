import { promises as fs } from "fs";
import { EventEmitter, Stream } from "stream";

import "reflect-metadata";

import config from "config";

import {
    CallbackQuery,
    ChatId,
    ChatMemberUpdated,
    default as TelegramBot,
    EditMessageTextOptions,
    InlineKeyboardMarkup,
    InputMedia,
    InputMediaPhoto,
    Message,
    ReplyKeyboardMarkup,
    SendMessageOptions,
} from "node-telegram-bot-api";
import { dir, file } from "tmp-promise";

import { BotConfig, BotFeatureFlag } from "@config";

import { User } from "@data/models";
import { UserRole } from "@data/types";

import logger from "@services/common/logger";
import { hasRole, isBanned, userService } from "@services/domain/user";

import { chunkSubstr } from "@utils/text";
import { hashMD5 } from "@utils/common";
import { readFileAsBase64 } from "@utils/filesystem";
import { DeltaStream } from "@services/neural/openwebui";
import { openAI } from "@services/neural/openai";

import t, { DEFAULT_LANGUAGE, isSupportedLanguage } from "../localization";
import { effectiveName, OptionalRegExp, prepareMessageForMarkdown, tgUserLink } from "../helpers";
import BotMessageContext, { DefaultModes } from "./BotMessageContext";
import BotState from "./BotState";
import {
    DEFAULT_CLEAR_QUEUE_LENGTH,
    DEFAULT_CLEAR_QUEUE_TIMEOUT,
    DEFAULT_TEMPORARY_MESSAGE_TIMEOUT,
    FULL_PERMISSIONS,
    IGNORE_UPDATE_TIMEOUT,
    IMPERSONATION_MARKER,
    MAX_MESSAGE_LENGTH,
    MAX_STREAMING_WINDOW,
    POLLING_OPTIONS,
    RESTRICTED_PERMISSIONS,
} from "../constants";
import MessageHistory from "./MessageHistory";
import { RateLimiter, UserRateLimiter } from "./RateLimit";
import {
    BotAllowedReaction,
    BotCallbackHandler,
    BotCustomEvent,
    BotHandler,
    BotMessageContextMode,
    BotRoute,
    CallbackData,
    ChatMemberHandler,
    EditMessageMediaOptionsExt,
    ITelegramUser,
    MatchMapperFunction,
    SendMediaGroupOptionsExt,
    SerializedFunction,
    BotAssets,
    BotController,
} from "../types";
import { ButtonFlags, InlineDeepLinkButton } from "../inlineButtons";
import ChatBridge from "./ChatBridge";
import { MetadataKeys, NonTopicChats, PublicChats, RouteMetadata } from "../decorators";

const botConfig = config.get<BotConfig>("bot");

const WelcomeMessageMap: {
    [x: number]: string | undefined;
} = {
    [botConfig.chats.main]: "service.welcome.main",
    [botConfig.chats.offtopic]: "service.welcome.offtopic",
    [botConfig.chats.key]: "service.welcome.key",
    [botConfig.chats.horny]: "service.welcome.horny",
};

export default class HackerEmbassyBot extends TelegramBot {
    public name: string = botConfig.name;
    public customEmitter = new EventEmitter();
    public botState = new BotState(this);
    public botMessageHistory = new MessageHistory(this.botState, this.botState.history, botConfig.history.commandsLimit);
    public messageHistory = new MessageHistory(this.botState, this.botState.messages, botConfig.history.messagesLimit);
    public assets: BotAssets = {
        images: {
            restricted: null,
            chatnotallowed: null,
        },
    };
    public pollingError: Error | null = null;
    public autoRemoveChats: number[] = [];
    public chatBridge = new ChatBridge();
    public forwardTarget = botConfig.chats.main;

    // Routes
    private routeMap = new Map<string, BotRoute>();
    private voiceHandler: BotHandler | null = null;
    private chatMemberHandler: ChatMemberHandler | null = null;

    // Context storage for user messages
    private contextMap = new Map();
    private guessIgnoreList = new Set(botConfig.guess.ignoreList);

    constructor(token: string) {
        // @ts-ignore polling options type in the lib is a lie
        super(token, { polling: POLLING_OPTIONS });
    }

    public start() {
        // Let's start listening for events
        this.on("message", this.routeMessage);
        this.on("callback_query", this.routeCallback);
        if (this.voiceHandler) this.on("voice", this.voiceHandler.bind(this, this));
        if (this.chatMemberHandler) this.onExt("chat_member", this.chatMemberHandler);
        if (botConfig.features.reactions) this.on("message", message => this.reactToMessage(message));

        this.on("error", error => logger.error(error));
        this.on("polling_error", error => {
            this.pollingError = error;
            logger.error(error);
        });

        this.startPolling();

        logger.info(`--- Bot ${this.name} started polling ---`);
    }

    public get url(): string {
        return `https://t.me/${this.name}`;
    }

    processUpdate(update: TelegramBot.Update): void {
        this.pollingError = null;
        super.processUpdate(update);
    }

    isUserAllowed(user: Nullable<User>, command: string): boolean {
        const savedRestrictions = this.routeMap.get(command)?.userRoles;

        if (!savedRestrictions || savedRestrictions.length === 0) return true;
        if (user) return hasRole(user, "admin", ...savedRestrictions);

        return savedRestrictions.includes("default");
    }

    isChatAllowed(chatId: number, command: string): boolean {
        const savedRestrictions = this.routeMap.get(command)?.allowedChats;

        if (!savedRestrictions || savedRestrictions.length === 0) return true;
        if (savedRestrictions.includes(chatId)) return true;

        return false;
    }

    canUserGuess(user: Nullable<User>, chat: TelegramBot.Chat): boolean {
        if (!botConfig.features.ai || !user) return false;

        return (hasRole(user, "member", "trusted", "admin") && PublicChats.includes(chat.id)) || hasRole(user, "admin");
    }

    context(msg: TelegramBot.Message): BotMessageContext {
        // TODO: remove this when the live messages will be fixed
        return this.contextMap.get(msg) ?? this.startContext(msg, userService.prepareUser(msg.from as TelegramBot.User));
    }

    startContext(msg: TelegramBot.Message, user: User, command?: string) {
        const newContext = new BotMessageContext(user, msg, command);
        this.contextMap.set(msg, newContext);

        return newContext;
    }

    clearContext(msg: TelegramBot.Message): void {
        this.contextMap.delete(msg);
    }

    onExt(
        event: TelegramBot.MessageType | "callback_query" | "chat_member",
        listener: BotHandler | BotCallbackHandler | ChatMemberHandler
    ): void {
        const newListener = (query: CallbackQuery | Message) => {
            listener.bind(this)(this, query as CallbackQuery & Message & ChatMemberUpdated);
        };

        // @ts-ignore
        super.on(event, newListener);
    }

    get addedModifiersString(): string {
        return Object.keys(DefaultModes)
            .reduce((acc, key) => {
                return `${acc} -${key}|`;
            }, "(")
            .replace(/\|$/, ")*");
    }

    editMessageTextExt(
        text: string,
        msg: TelegramBot.Message,
        options: TelegramBot.EditMessageTextOptions
    ): Promise<boolean | TelegramBot.Message> {
        text = options.parse_mode !== undefined ? text : prepareMessageForMarkdown(text);
        options.message_thread_id = msg.message_thread_id;
        options =
            options.parse_mode !== undefined
                ? options
                : (this.prepareOptionsForMarkdown({
                      ...options,
                  }) as EditMessageTextOptions);

        return super.editMessageText(text, options);
    }

    async sendPhotoExt(
        chatId: TelegramBot.ChatId,
        photo: string | Stream | Buffer,
        msg: TelegramBot.Message,
        options: TelegramBot.SendPhotoOptions = {},
        fileOptions: TelegramBot.FileOptions = {}
    ): Promise<TelegramBot.Message> {
        const context = this.context(msg);
        const mode = this.context(msg).mode;
        const chatIdToUse = mode.forward ? this.forwardTarget : chatId;
        const inline_keyboard =
            mode.static || !options.reply_markup ? [] : (options.reply_markup as InlineKeyboardMarkup).inline_keyboard;

        if (options.caption) {
            options.caption = prepareMessageForMarkdown(options.caption);
            options = this.prepareOptionsForMarkdown({ ...options });
        }

        this.sendChatAction(chatId, "upload_photo", msg);

        const photoHash = photo instanceof Stream ? null : hashMD5(photo);
        const cachedFileId = photoHash ? this.botState.fileIdCache[photoHash] : null;

        const message = await this.sendPhoto(
            chatIdToUse,
            cachedFileId ?? photo,
            {
                ...options,
                reply_markup: {
                    inline_keyboard,
                },
                message_thread_id: context.messageThreadId,
            },
            fileOptions
        );

        if (!cachedFileId && photoHash && message.photo) {
            this.botState.fileIdCache[photoHash] = message.photo[0].file_id;
            this.botState.debouncedPersistChanges();
        }

        if (mode.pin) {
            this.tryPinChatMessage(message, context.user);
        }

        this.botMessageHistory.push(chatId, { messageId: message.message_id, text: message.caption });

        return Promise.resolve(message);
    }

    // TODO extract common logic from here sendPhotoExt
    async sendAnimationExt(
        chatId: ChatId,
        animation: string | Stream | Buffer,
        msg: TelegramBot.Message,
        options?: TelegramBot.SendAnimationOptions
    ): Promise<TelegramBot.Message> {
        const context = this.context(msg);
        const mode = context.mode;
        const chatIdToUse = mode.forward ? this.forwardTarget : chatId;

        if (options?.caption) {
            options.caption = prepareMessageForMarkdown(options.caption);
            options = this.prepareOptionsForMarkdown({ ...options });
        }

        this.sendChatAction(chatId, "upload_photo", msg);

        const animationHash = animation instanceof Stream ? null : hashMD5(animation);
        const cachedFileId = animationHash ? this.botState.fileIdCache[animationHash] : null;

        const message = await this.sendAnimation(chatIdToUse, cachedFileId ?? animation, {
            ...options,
            message_thread_id: context.messageThreadId,
        });

        if (!cachedFileId && animationHash && message.animation) {
            this.botState.fileIdCache[animationHash] = message.animation.file_id;
            this.botState.debouncedPersistChanges();
        }

        if (mode.pin) {
            this.tryPinChatMessage(message, context.user);
        }

        this.botMessageHistory.push(chatId, { messageId: message.message_id, text: message.caption });

        return Promise.resolve(message);
    }

    async sendPhotos(
        chatId: TelegramBot.ChatId,
        photos: Buffer[] | ArrayBuffer[],
        msg: TelegramBot.Message,
        options: SendMediaGroupOptionsExt = {}
    ): Promise<TelegramBot.Message[]> {
        const mode = this.context(msg).mode;
        const chatIdToUse = mode.forward ? this.forwardTarget : chatId;

        this.sendChatAction(chatId, "upload_photo", msg);

        const buffers = photos.map(photo => (photo instanceof Buffer ? photo : Buffer.from(photo)));
        const imageOpts = buffers.map(buf => ({ type: "photo", media: buf as unknown as string }));

        const messages = await super.sendMediaGroup(chatIdToUse, imageOpts as InputMedia[], {
            ...options,
            // @ts-ignore
            message_thread_id: this.context(msg).messageThreadId,
        });

        for (const message of messages) {
            this.botMessageHistory.push(chatId, { messageId: message.message_id, text: message.caption });
        }

        return Promise.resolve(messages);
    }

    async editPhoto(
        photo: Buffer | ArrayBuffer,
        msg: TelegramBot.Message,
        options: EditMessageMediaOptionsExt = {}
    ): Promise<TelegramBot.Message | boolean> {
        const buffer = photo instanceof Buffer ? photo : Buffer.from(photo);

        // TMP file because the lib doesn't support using buffers for editMessageMedia yet
        const { path, cleanup } = await file();

        await fs.writeFile(path, buffer);

        const imageOption = { type: "photo", media: `attach://${path}` } as InputMediaPhoto;

        const inline_keyboard =
            this.context(msg).mode.static || !options.reply_markup ? [] : options.reply_markup.inline_keyboard;

        let message: Message | boolean = false;

        try {
            message = await super.editMessageMedia(imageOption, {
                ...options,
                reply_markup: {
                    inline_keyboard,
                },
                chat_id: msg.chat.id,
                message_id: msg.message_id,
                //@ts-ignore
                message_thread_id: this.context(msg).messageThreadId,
            });
        } catch (e) {
            // only ignore not modified error
            if (e instanceof Error && !e.message.includes("message is not modified")) throw e;
        }

        if (options.caption) {
            super.editMessageCaption(options.caption, {
                chat_id: msg.chat.id,
                message_id: msg.message_id,
                reply_markup: { inline_keyboard },
            });
        }

        cleanup();

        return Promise.resolve(message);
    }

    async sendLocationExt(
        chatId: TelegramBot.ChatId,
        latitude: number,
        longitude: number,
        msg: TelegramBot.Message,
        options: TelegramBot.SendLocationOptions = {}
    ): Promise<TelegramBot.Message> {
        return await super.sendLocation(chatId, latitude, longitude, {
            ...options,
            message_thread_id: this.context(msg).messageThreadId,
        });
    }

    sendAlert(text: string) {
        return this.sendMessageExt(botConfig.chats.alerts, text, null);
    }

    // TODO: add support for sending plain text and make it less bad

    async sendStreamedMessage(chatId: TelegramBot.ChatId, stream: DeltaStream, msg: TelegramBot.Message): Promise<boolean> {
        this.sendChatAction(chatId, "typing", msg);

        let messageToEdit: Nullable<TelegramBot.Message> = null;
        let buffer = "";
        let window = 0;

        try {
            for await (const chunk of stream) {
                if (chunk.response) {
                    buffer += chunk.response;
                    window += chunk.response.length;
                }

                // Skip empty chunks
                if (buffer.length === 0) continue;

                if (!messageToEdit) {
                    messageToEdit = await this.sendMessageExt(chatId, buffer, msg, {
                        // @ts-ignore hack to force raw parse mode as the lib doesn't support it
                        parse_mode: "",
                    });
                } else if (chunk.done || window >= MAX_STREAMING_WINDOW) {
                    await this.editMessageTextExt(buffer, messageToEdit, {
                        chat_id: chatId,
                        message_id: messageToEdit.message_id,
                        // @ts-ignore hack to force raw parse mode as the lib doesn't support it
                        parse_mode: "",
                    });

                    if (buffer.length > MAX_MESSAGE_LENGTH) {
                        messageToEdit = null;
                        buffer = "";
                    }

                    window = 0;
                }
            }

            return true;
        } catch (error) {
            logger.error(error);
            return false;
        }
    }

    async sendMessageExt(
        chatId: TelegramBot.ChatId,
        text: string,
        msg: Nullable<TelegramBot.Message>,
        options: TelegramBot.SendMessageOptions = {}
    ): Promise<Nullable<TelegramBot.Message>> {
        const preparedText = options.parse_mode !== undefined ? text : prepareMessageForMarkdown(text);
        options = options.parse_mode !== undefined ? options : this.prepareOptionsForMarkdown({ ...options });

        const context = msg && this.context(msg);
        const mode = context?.mode;
        const chatIdToUse = mode?.forward ? this.forwardTarget : chatId;

        const reply_markup = !mode?.static
            ? (options.reply_markup as InlineKeyboardMarkup | ReplyKeyboardMarkup | undefined)
            : undefined;

        const message_thread_id = msg ? this.context(msg).messageThreadId : undefined;

        if (!msg || !mode?.silent) {
            const message = await this.sendMessage(chatIdToUse, preparedText, {
                ...options,
                reply_markup,
                message_thread_id,
            });

            if (context?.user && mode?.pin) {
                this.tryPinChatMessage(message, context.user);
            }

            this.botMessageHistory.push(chatId, { messageId: message.message_id, text });

            return Promise.resolve(message);
        }

        return Promise.resolve(null);
    }

    async sendTemporaryMessage(
        chatId: TelegramBot.ChatId,
        text: string,
        msg: TelegramBot.Message,
        options: TelegramBot.SendMessageOptions = {},
        timeout = DEFAULT_TEMPORARY_MESSAGE_TIMEOUT
    ): Promise<void> {
        const message = await this.sendMessageExt(chatId, text, msg, options);

        if (message) {
            setTimeout(() => {
                this.deleteMessage(msg.chat.id, message.message_id).catch(() => {});
                // try deleting the initial message if the bot has admin rights
                this.deleteMessage(msg.chat.id, msg.message_id).catch(() => {});
            }, timeout);
        }
    }

    tryPinChatMessage(message: TelegramBot.Message, user: User) {
        try {
            if (hasRole(user, "admin", "member"))
                this.pinChatMessage(message.chat.id, message.message_id, { disable_notification: true });
        } catch (e) {
            logger.error(e);
        }
    }

    sendChatAction(
        chatId: TelegramBot.ChatId,
        action: TelegramBot.ChatAction,
        msg: TelegramBot.Message,
        options: TelegramBot.SendChatActionOptions = {}
    ): Promise<boolean> {
        const mode = this.context(msg).mode;
        const chatIdToUse = mode.forward ? this.forwardTarget : chatId;

        return super.sendChatAction(chatIdToUse, action, {
            ...options,
            message_thread_id: this.context(msg).messageThreadId,
        });
    }

    async sendLongMessage(
        chatId: TelegramBot.ChatId,
        text: string,
        msg: TelegramBot.Message,
        options: TelegramBot.SendMessageOptions = {}
    ): Promise<void> {
        if (text.length <= MAX_MESSAGE_LENGTH) {
            await this.sendMessageExt(chatId, text, msg, options);
            return;
        }

        const messageResponses = chunkSubstr(text, MAX_MESSAGE_LENGTH)
            .map((chunk, index) => `📧 ${index + 1} часть 📧\n\n${chunk}\n📧 Конец части ${index + 1} 📧`)
            .map(chunk => () => this.sendMessageExt(chatId, chunk, msg, options));

        RateLimiter.executeOverTime(messageResponses);
    }

    private deleteQueue: number[] = [];
    private deleteTimeout: NodeJS.Timeout | null = null;

    // Prevents spamming delete messages to cause 429 errors
    async deleteMessageQueued(
        chatId: ChatId,
        messageId: number,
        timeout = DEFAULT_CLEAR_QUEUE_TIMEOUT,
        queueSize = DEFAULT_CLEAR_QUEUE_LENGTH
    ) {
        if (this.deleteQueue.length === queueSize) {
            const messages = this.deleteQueue;
            this.deleteQueue = [];
            await this.deleteMessages(chatId, messages);
        } else {
            this.deleteQueue.push(messageId);
            if (!this.deleteTimeout) {
                this.deleteTimeout = setTimeout(() => {
                    this.deleteMessages(chatId, this.deleteQueue);
                    this.deleteQueue = [];
                    this.deleteTimeout = null;
                }, timeout);
            }
        }
    }

    private isBotCommand(text?: string): boolean {
        if (!text) return false;

        const botNameRequested = this.name ? /^\/\S+?@(\S+)/.exec(text)?.[1] : null;
        const forAnotherBot = !!botNameRequested && botNameRequested !== this.name;

        return text.startsWith("/") && !forAnotherBot;
    }

    private extractImpersonatedUser(text: string): string | number {
        const identifier = text.split(IMPERSONATION_MARKER)[1];
        return identifier.startsWith("@") ? identifier.slice(1) : Number.parseInt(identifier);
    }

    async routeMessage(message: TelegramBot.Message) {
        try {
            // Skip old updates
            if (Math.abs(Date.now() / 1000 - message.date) > IGNORE_UPDATE_TIMEOUT) return;

            // Autoremove messages from some chats
            if (this.autoRemoveChats.includes(message.chat.id))
                return this.deleteMessageQueued(message.chat.id, message.message_id);

            // Forward messages between chats
            if (botConfig.features.chatbridge) {
                const adminId = this.chatBridge.getLinkedAdmin(message.chat.id);
                if (adminId)
                    return this.forwardMessage(adminId, message.chat.id, message.message_id).catch(error => logger.error(error));

                const chatId = this.chatBridge.getLinkedChat(message.chat.id);
                if (chatId && !message.text?.startsWith("/"))
                    return this.copyMessage(chatId, message.chat.id, message.message_id).catch(error => logger.error(error));
            }

            // Change forward target if needed
            if (message.chat_shared?.chat_id) {
                this.forwardTarget = message.chat_shared.chat_id;
                return;
            }

            // Get command from message text or a deeplink
            const deeplink = message.text?.match(/\/start (.*)/)?.[1].replaceAll("__", " ");
            const text = deeplink ? `/${deeplink}` : ((message.text ?? message.caption) as string);
            const isCommand = this.isBotCommand(text);

            // If the message is not a command, we can skip or save it to history
            if (!isCommand) {
                const messageText = message.text ?? message.caption;
                if (
                    botConfig.features.history &&
                    message.from &&
                    !message.from.is_bot &&
                    // TODO: Allow public chats after testing
                    NonTopicChats.includes(message.chat.id) &&
                    messageText
                ) {
                    this.messageHistory.push(message.chat.id, {
                        messageId: message.message_id,
                        text: messageText,
                        from: effectiveName(message.from),
                    });
                }

                return;
            }

            const fullCommand = text.split(" ")[0];
            const commandWithCase = fullCommand.split("@")[0].slice(1);
            const command = commandWithCase.toLowerCase();
            const route = this.routeMap.get(command);

            // Prepare context
            const actualUser = userService.prepareUser(message.from as TelegramBot.User);
            const isAdmin = hasRole(actualUser, "admin");
            const impersonatedUser =
                isAdmin && text.includes(IMPERSONATION_MARKER) ? userService.getUser(this.extractImpersonatedUser(text)) : null;
            const user = impersonatedUser ?? actualUser;

            const messageContext = this.startContext(message, user, command);
            messageContext.language = isSupportedLanguage(user.language) ? user.language : DEFAULT_LANGUAGE;
            messageContext.messageThreadId = message.is_topic_message ? message.message_thread_id : undefined;

            // Try to guess the answer if no route is found for members, especially for @CabiaRangris
            if (!route) {
                return !this.guessIgnoreList.has(command) && this.canUserGuess(user, message.chat)
                    ? await messageContext.run(() =>
                          openAI
                              .askChat(text, t("embassy.neural.contexts.guess"))
                              .then(guess => this.sendMessageExt(message.chat.id, "[ai generated] " + guess, message))
                              .catch(error => logger.error(error))
                      )
                    : null;
            }

            // Check restritions
            if (isBanned(user)) return;

            const canSkipRestrictions = isAdmin && !impersonatedUser;

            if (!canSkipRestrictions && route.userRoles.length > 0 && !this.isUserAllowed(user, command))
                return await messageContext.run(() => this.sendRestrictedMessage(message, route, "restricted"));
            if (!canSkipRestrictions && route.allowedChats.length > 0 && !this.isChatAllowed(message.chat.id, command))
                return await messageContext.run(() => this.sendRestrictedMessage(message, route, "chatnotallowed"));

            // Parse global modifiers and set them to the context
            let textToMatch = text.replace(commandWithCase, command);

            if (impersonatedUser) textToMatch = textToMatch.slice(0, textToMatch.indexOf(IMPERSONATION_MARKER)).trimEnd();

            for (const key of Object.keys(messageContext.mode)) {
                if (textToMatch.includes(`-${key}`)) messageContext.mode[key as keyof BotMessageContextMode] = true;
                textToMatch = textToMatch.replace(` -${key}`, "");
            }

            messageContext.mode.secret = this.isSecretModeAllowed(message, messageContext);

            // Call message handler with params
            if (route.paramMapper) {
                const match = route.regex.exec(textToMatch);
                const matchedParams = match ? route.paramMapper(match) : null;

                if (matchedParams) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                    await messageContext.run(() => route.handler(this, message, ...matchedParams));
                    return;
                } else if (!route.optional) {
                    return;
                }
            }

            // Call message handler without params
            await messageContext.run(() => route.handler(this, message));
        } catch (error) {
            logger.error(error);
        } finally {
            this.clearContext(message);
        }
    }

    async routeCallback(callbackQuery: TelegramBot.CallbackQuery) {
        const msg = callbackQuery.message;

        try {
            await this.answerCallbackQuery(callbackQuery.id);

            if (!msg?.from) throw Error("Callback query missing the sender, aborting...");

            await UserRateLimiter.throttled(this.callbackHandler.bind(this), msg.from.id)(callbackQuery, msg);
        } catch (error) {
            logger.error(error);
        } finally {
            if (msg) this.clearContext(msg);
        }
    }

    async callbackHandler(callbackQuery: TelegramBot.CallbackQuery, msg: Message) {
        // Parse callback data
        msg.from = callbackQuery.from;
        const data = callbackQuery.data ? (JSON.parse(callbackQuery.data) as CallbackData) : undefined;
        if (!data) throw Error("Missing calback query data");

        // Prepare context
        const user = userService.prepareUser(msg.from);
        const context = this.startContext(msg, user);
        context.messageThreadId = msg.message_thread_id;
        context.mode.secret = this.isSecretModeAllowed(msg, context);
        context.language = isSupportedLanguage(user.language) ? user.language : DEFAULT_LANGUAGE;
        context.isButtonResponse = true;

        // Extract command or user verification request
        if (data.vId)
            return callbackQuery.from.id === data.vId
                ? context.run(() => this.handleUserVerification(data.vId as number, data.params as string, msg))
                : null;

        if (!data.cmd) throw Error("Missing calback command");

        // Check restritions
        if (isBanned(user) || !this.isUserAllowed(user, data.cmd)) return;

        // Get route handler
        const handler = this.routeMap.get(data.cmd)?.handler;
        if (!handler) throw Error(`Route handler for ${data.cmd} does not exist`);

        // Apply callback mode flags
        if (data.fs !== undefined) {
            if (data.fs & ButtonFlags.Silent) context.mode.silent = true;
            if (data.fs & ButtonFlags.Editing) context.isEditing = true;
        }

        // Call callback handler with params
        const params: [HackerEmbassyBot, TelegramBot.Message, ...any] = [this, msg];

        if (data.params !== undefined) {
            if (Array.isArray(data.params)) params.push(...(data.params as unknown[]));
            else params.push(data.params);
        }

        await context.run(() => handler.apply(this, params));
    }

    private async handleUserVerification(vId: number, language: string, msg: TelegramBot.Message) {
        try {
            const userChat = await this.getChat(vId);
            const success = userService.verifyUser({ id: userChat.id, username: userChat.username }, language);

            if (!success) throw new Error("Failed to verify user");

            botConfig.moderatedChats.forEach(chatId =>
                this.unlockChatMember(chatId, userChat.id).catch(error => logger.error(error))
            );

            await this.sendWelcomeMessage(msg.chat, userChat, language);
            await this.deleteMessage(msg.chat.id, msg.message_id);
        } catch (error) {
            logger.error(error);
        }
    }

    public async sendWelcomeMessage(chat: TelegramBot.Chat, tgUser: ITelegramUser, language?: string) {
        const inline_keyboard = [[InlineDeepLinkButton(t("service.welcome.buttons.about"), this.name, "about")]];

        await this.sendMessageExt(
            chat.id,
            t(
                WelcomeMessageMap[chat.id] ?? "service.welcome.main",
                { botName: this.name, newMember: tgUserLink(tgUser) },
                language
            ),
            null,
            {
                reply_markup: {
                    inline_keyboard,
                },
            }
        );
    }

    reactToMessage(message: TelegramBot.Message) {
        try {
            if (message.text?.match(/(^|\s)(бот([еуа]|ом)?|bot)(\s|,|\.|$)/giu)) {
                this.setMessageReaction(message.chat.id, message.message_id, "👀");
            } else if (
                message.text?.match(/(^|\s)(\u0063\u006F\u0063\u006B|\u043A\u043E\u043A|\u0434\u0438\u043A|piska)(\s|,|\.|$|@)/giu)
            ) {
                this.setMessageReaction(message.chat.id, message.message_id, "🌭");
            } else if (message.text?.match(/(^|\s)([Кк]аб([еуа]|ом)?)([^а-яА-Я0-9]|$)/giu)) {
                this.setMessageReaction(message.chat.id, message.message_id, "🦄");
            }
        } catch (error) {
            logger.error(error);
        }
    }

    public isSecretModeAllowed(message: TelegramBot.Message, messageContext: BotMessageContext): boolean {
        const alwaysSecretChats = [botConfig.chats.key, botConfig.chats.alerts];

        if (alwaysSecretChats.includes(message.chat.id)) return true;

        if (messageContext.user.roles?.includes("member")) {
            return messageContext.isPrivate() || messageContext.mode.secret;
        }

        return false;
    }

    public async sendRestrictedMessage(
        message: TelegramBot.Message,
        route?: BotRoute,
        type: keyof typeof this.assets.images = "restricted"
    ) {
        this.assets.images[type] = await fs.readFile(`./resources/images/errors/${type}.png`).catch(() => null);

        if (this.assets.images[type]) {
            this.sendPhotoExt(message.chat.id, this.assets.images[type], message, {
                caption: t(`general.errors.${type}`, { required: route ? route.userRoles.join(", ") : "someone else" }),
            });
        } else {
            this.sendMessageExt(
                message.chat.id,
                t(`general.errors.${type}`, { required: route ? route.userRoles.join(", ") : "someone else" }),
                message
            );
        }
    }

    addEventRoutes(voiceHandler: BotHandler, chatMemberHandler: ChatMemberHandler) {
        this.voiceHandler = voiceHandler;
        this.chatMemberHandler = chatMemberHandler;
    }

    addController(controller: BotController) {
        const decoratedMethods = Object.getOwnPropertyNames(controller)
            .filter(
                name =>
                    typeof controller[name as keyof BotController] === "function" &&
                    name !== "prototype" &&
                    name !== "length" &&
                    name !== "name"
            )
            .filter(name => Reflect.getMetadata(MetadataKeys.Route, controller, name));

        for (const methodName of decoratedMethods) {
            const featureFlag = Reflect.getMetadata(MetadataKeys.FeatureFlag, controller, methodName) as
                | BotFeatureFlag
                | undefined;

            if (featureFlag && !botConfig.features[featureFlag]) continue;

            const roles = Reflect.getMetadata(MetadataKeys.Roles, controller, methodName) as UserRole[];
            const routes = Reflect.getMetadata(MetadataKeys.Route, controller, methodName) as RouteMetadata[];
            const allowedChats = Reflect.getMetadata(MetadataKeys.AllowedChats, controller, methodName) as ChatId[];
            const method = controller[methodName as keyof BotController] as BotHandler;
            const handler = method.bind(controller);

            for (const route of routes) {
                this.addRoute(route.aliases, handler, route.paramRegex, route.paramMapper, roles, allowedChats);
            }
        }
    }

    addRoute(
        aliases: string[],
        handler: BotHandler,
        paramRegex: Nullable<RegExp> = null,
        paramMapper: Nullable<MatchMapperFunction> = null,
        userRoles: UserRole[] = [],
        allowedChats: ChatId[] = []
    ): void {
        const optional = paramRegex instanceof OptionalRegExp;
        const regex = this.createRegex(aliases, paramRegex, optional);
        const botRoute = {
            regex,
            handler,
            paramMapper,
            optional,
            userRoles,
            allowedChats,
        };

        for (const alias of aliases) {
            this.routeMap.set(alias, botRoute);
        }
    }

    async sendOrEditMessage(
        chatId: number,
        text: string,
        msg: TelegramBot.Message,
        options: TelegramBot.EditMessageTextOptions | TelegramBot.SendMessageOptions,
        messageId: number
    ): Promise<Message | boolean | null> {
        if (this.context(msg).isEditing) {
            try {
                return await this.editMessageTextExt(text, msg, {
                    chat_id: chatId,
                    message_id: messageId,
                    ...options,
                } as TelegramBot.EditMessageTextOptions);
            } catch {
                // Message was not modified
            } finally {
                this.context(msg).isEditing = false;
            }
        } else {
            return this.sendMessageExt(chatId, text, msg, options as SendMessageOptions);
        }

        return null;
    }

    async sendOrEditPhoto(
        chatId: number,
        photo: Buffer | ArrayBuffer,
        msg: TelegramBot.Message,
        options: TelegramBot.SendPhotoOptions
    ): Promise<Message | boolean | null> {
        if (this.context(msg).isEditing) {
            try {
                return await this.editPhoto(photo, msg, {
                    chat_id: chatId,
                    message_id: msg.message_id,
                    ...options,
                } as TelegramBot.EditMessageTextOptions);
            } catch {
                // Message was not modified
            } finally {
                this.context(msg).isEditing = false;
            }
        } else {
            return this.sendPhotoExt(chatId, photo as Buffer, msg, options);
        }

        return null;
    }

    async fetchFileAsBase64(fileId: string) {
        const { path, cleanup } = await dir({
            unsafeCleanup: true,
        });
        const photoPath = await this.downloadFile(fileId, path);
        const fileString = await readFileAsBase64(photoPath);
        cleanup();

        return fileString;
    }

    addLiveMessage(
        liveMessage: Message,
        event: BotCustomEvent,
        handler: (...args: any[]) => Promise<void>,
        serializationData: SerializedFunction
    ) {
        const chatRecordIndex = this.botState.liveChats.findIndex(cr => cr.chatId === liveMessage.chat.id && cr.event === event);
        if (chatRecordIndex !== -1) this.customEmitter.removeListener(event, this.botState.liveChats[chatRecordIndex].handler);

        this.customEmitter.on(event, handler);
        const newChatRecord = {
            chatId: liveMessage.chat.id,
            handler,
            event,
            serializationData,
        };

        if (chatRecordIndex !== -1) {
            this.botState.liveChats[chatRecordIndex] = newChatRecord;
        } else {
            this.botState.liveChats.push(newChatRecord);
        }

        this.botState.debouncedPersistChanges();
    }

    lockChatMember(chatId: ChatId, userId: number) {
        return this.restrictChatMember(chatId, userId, RESTRICTED_PERMISSIONS);
    }

    unlockChatMember(chatId: ChatId, userId: number) {
        return this.restrictChatMember(chatId, userId, FULL_PERMISSIONS);
    }

    restrictChatMember(
        chatId: ChatId,
        userId: number,
        options: TelegramBot.ChatPermissions & {
            until_date?: number;
            use_independent_chat_permissions?: boolean;
        }
    ) {
        return super.restrictChatMember(chatId, userId, options);
    }

    private createRegex(aliases: string[], paramRegex: Nullable<RegExp>, optional: boolean = false) {
        const commandPart = `/(?:${aliases.join("|")})`;
        const botnamePart = this.name ? `(?:@${this.name})?` : "";

        let paramsPart = "";
        if (paramRegex) paramsPart = optional ? paramRegex.source : ` ${paramRegex.source}`;

        return new RegExp(`^${commandPart}${botnamePart}${paramsPart}$`, paramRegex?.flags);
    }

    private prepareOptionsForMarkdown(
        options: SendMessageOptions | EditMessageTextOptions
    ): TelegramBot.SendMessageOptions | TelegramBot.EditMessageTextOptions {
        options.parse_mode = "MarkdownV2";
        options.disable_web_page_preview = true;

        return options;
    }

    setMessageReaction(chatId: ChatId, messageId: number, reaction: BotAllowedReaction): Promise<boolean> {
        //@ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        return super.setMessageReaction(chatId, messageId, {
            reaction: [
                {
                    type: "emoji",
                    emoji: reaction,
                },
            ],
        });
    }

    deleteMessages(chatId: ChatId, messageIds: number[]): Promise<boolean> {
        //@ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        return super.deleteMessages(chatId, messageIds);
    }

    //#region Base methods
    /*
     * Base TelegramBot methods, which should be used directly only in rare cases.
     * They don't know how to properly handle message context, message modes,
     * message threads, custom events etc, so use their extended versions outside of this class when possible.
     */

    /**
     * @deprecated Do not use directly
     * @see editMessageTextExt
     */
    editMessageText(text: string, options?: TelegramBot.EditMessageTextOptions): Promise<boolean | TelegramBot.Message> {
        return super.editMessageText(text, options);
    }

    /**
     * @deprecated Do not use directly
     * @see sendPhotoExt
     */
    sendPhoto(
        chatId: ChatId,
        photo: string | Stream | Buffer,
        options?: TelegramBot.SendPhotoOptions,
        fileOptions?: TelegramBot.FileOptions
    ): Promise<TelegramBot.Message> {
        return super.sendPhoto(chatId, photo, options, fileOptions);
    }

    /**
     * @deprecated Do not use directly
     * @see sendAnimationExt
     */
    sendAnimation(
        chatId: ChatId,
        animation: string | Stream | Buffer,
        options?: TelegramBot.SendAnimationOptions
    ): Promise<TelegramBot.Message> {
        return super.sendAnimation(chatId, animation, options);
    }

    /**
     * @deprecated Do not use directly
     * @see sendMessageExt
     */
    sendMessage(chatId: ChatId, text: string, options?: TelegramBot.SendMessageOptions): Promise<TelegramBot.Message> {
        return super.sendMessage(chatId, text, options);
    }

    /**
     * @deprecated Do not use directly
     * @see sendLocationExt
     */
    sendLocation(
        chatId: ChatId,
        latitude: number,
        longitude: number,
        options?: TelegramBot.SendLocationOptions
    ): Promise<TelegramBot.Message> {
        return super.sendLocation(chatId, latitude, longitude, options);
    }

    /**
     * @deprecated Do not use directly
     * @see addRoute
     */
    onText(regexp: RegExp, callback: (msg: TelegramBot.Message, match: RegExpExecArray | null) => void): void {
        return super.onText(regexp, callback);
    }
    //#endregion
}
