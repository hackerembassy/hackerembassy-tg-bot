import { InlineKeyboardButton, Message } from "node-telegram-bot-api";

import logger from "@services/common/logger";
import wiki, { PageListTreeNode } from "@services/external/wiki";
import { cropStringAtSpace } from "@utils/text";

import { Route } from "@hackembot/core/decorators";

import { MAX_MESSAGE_LENGTH } from "../core/constants";
import HackerEmbassyBot from "../core/classes/HackerEmbassyBot";
import { formatMonospaced, OptionalParam } from "../core/helpers";
import { ButtonFlags, chunkButtonsForMobile, InlineButton } from "../core/inlineButtons";
import t from "../core/localization";
import { BotController } from "../core/types";

// Leaf pages (no children of their own) are listed before sub-sections, within each parent's children.
function leavesFirst(nodes: PageListTreeNode[]): PageListTreeNode[] {
    return [...nodes].sort((a, b) => Number(a.children.length > 0) - Number(b.children.length > 0));
}

// Each path already includes its parents (e.g. "getting-started/setup"), so this doesn't draw a full
// tree - just a 2-space indent per depth level, plus a blank line between top-level groups, so pages
// belonging to different sections are still easy to tell apart.
function wikiPageGroupLines(node: PageListTreeNode, parentPath: string, depth = 0): string[] {
    const path = wiki.nodePath(node, parentPath);
    const icon = node.children.length > 0 ? "📁" : "📄";
    const indent = "  ".repeat(depth);

    return [
        `${indent}${icon} ${formatMonospaced(path)}`,
        ...leavesFirst(node.children).flatMap(child => wikiPageGroupLines(child, path, depth + 1)),
    ];
}

function listWikiPagePaths(nodes: PageListTreeNode[], basePath = ""): string[] {
    return leavesFirst(nodes).flatMap((node, index) =>
        index === 0 ? wikiPageGroupLines(node, basePath) : ["", ...wikiPageGroupLines(node, basePath)]
    );
}

function WikiPageButton(title: string, path?: string): InlineKeyboardButton | undefined {
    const button = InlineButton(
        cropStringAtSpace(title, 24),
        "wiki",
        ButtonFlags.Editing,
        path === undefined ? {} : { params: path }
    );

    return Buffer.byteLength(button.callback_data) <= 64 ? button : undefined;
}

export default class WikiController implements BotController {
    @Route(["wiki", "w", "wcat"], OptionalParam(/(\S+)/), match => [match[1]])
    static async wikiHandler(bot: HackerEmbassyBot, msg: Message, path?: string) {
        try {
            if (!path) {
                const topNodes = await wiki.listPagesAsTree();
                const buttons = topNodes
                    .map(node => WikiPageButton(node.label ?? "?", wiki.nodePath(node, "")))
                    .filter((button): button is InlineKeyboardButton => button !== undefined);

                const inline_keyboard = [
                    ...chunkButtonsForMobile(buttons),
                    [
                        InlineButton(t("general.buttons.back"), "infopanel", ButtonFlags.Editing),
                        InlineButton(t("wiki.buttons.hide"), "wikihide"),
                    ],
                ];

                await bot.sendOrEditMessage(
                    msg.chat.id,
                    t("wiki.help"),
                    msg,
                    { reply_markup: { inline_keyboard } },
                    msg.message_id
                );
                return;
            }

            const found = await wiki.findTreeNode(path);

            if (!found) {
                await bot.sendMessageExt(msg.chat.id, t("wiki.page.notfound", { pagename: path }), msg);
                return;
            }

            const { node, path: resolvedPath } = found;
            const pageId = String(node.id);
            const content = await wiki.getPageContent(pageId);

            if (!content) {
                await bot.sendMessageExt(msg.chat.id, t("wiki.page.notfound", { pagename: path }), msg);
                return;
            }

            const sourceUrl = await wiki.getSourceUrl(pageId);
            const sourceLine = sourceUrl ? `> 🔗 ${t("wiki.page.source")}: [${sourceUrl}](${sourceUrl})` : "";
            const fullMessage = sourceLine ? `${content.trimEnd()}\n\n${sourceLine}` : content;

            const childButtons = node.children
                .map(child => WikiPageButton(child.label ?? "?", wiki.nodePath(child, resolvedPath)))
                .filter((button): button is InlineKeyboardButton => button !== undefined);
            const parentPath = resolvedPath.includes("/") ? resolvedPath.slice(0, resolvedPath.lastIndexOf("/")) : undefined;
            const backButton =
                WikiPageButton(t("general.buttons.back"), parentPath) ??
                InlineButton(t("general.buttons.back"), "wiki", ButtonFlags.Editing);

            const inline_keyboard = [
                ...chunkButtonsForMobile(childButtons),
                [backButton, InlineButton(t("wiki.buttons.hide"), "wikihide")],
            ];

            if (fullMessage.length <= MAX_MESSAGE_LENGTH) {
                await bot.sendOrEditMessage(
                    msg.chat.id,
                    fullMessage,
                    msg,
                    { parse_mode: "GFM", baseUrl: wiki.baseUrl, reply_markup: { inline_keyboard } },
                    msg.message_id
                );
                return;
            }

            // Chunked messages can't carry a single coherent keyboard, so the content goes out as today
            // and the navigation buttons follow as one short trailer message instead.
            await bot.sendLongMessage(msg.chat.id, fullMessage, msg, { parse_mode: "GFM", baseUrl: wiki.baseUrl });
            await bot.sendMessageExt(msg.chat.id, t("wiki.page.navigation", { path: resolvedPath }), msg, {
                reply_markup: { inline_keyboard },
            });
        } catch (error) {
            await bot.sendMessageExt(msg.chat.id, t("wiki.general.errors.generic"), msg);
            logger.error(error);
        }
    }

    @Route(["wikihide"])
    static async wikiHideHandler(bot: HackerEmbassyBot, msg: Message) {
        if (!msg.message_id) {
            logger.warn("wikiHideHandler: message_id is undefined");
            return;
        }

        if (!bot.context(msg).isButtonResponse) {
            logger.warn("wikiHideHandler: not a button response");
            return;
        }

        await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: msg.chat.id, message_id: msg.message_id });
    }

    @Route(["wikitree", "wikilist", "wls"], OptionalParam(/(\S+)/), match => [match[1]])
    static async wikiTreeHandler(bot: HackerEmbassyBot, msg: Message, parentPath?: string) {
        try {
            let nodes: PageListTreeNode[];
            let basePath = "";

            if (parentPath) {
                const found = await wiki.findTreeNode(parentPath);

                if (!found) {
                    await bot.sendMessageExt(msg.chat.id, t("wiki.page.notfound", { pagename: parentPath }), msg);
                    return;
                }

                nodes = found.node.children;
                basePath = found.path;
            } else {
                nodes = await wiki.listPagesAsTree();
            }

            const lines = listWikiPagePaths(nodes, basePath);

            if (lines.length === 0) {
                await bot.sendMessageExt(msg.chat.id, t("wiki.list.empty"), msg);
                return;
            }

            await bot.sendLongMessage(msg.chat.id, t("wiki.list.text", { pages: lines.join("\n") }), msg);
        } catch (error) {
            await bot.sendMessageExt(msg.chat.id, t("wiki.general.errors.generic"), msg);
            logger.error(error);
        }
    }
}
