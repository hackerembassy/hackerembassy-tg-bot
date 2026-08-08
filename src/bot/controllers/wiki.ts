import { Message } from "node-telegram-bot-api";

import logger from "@services/common/logger";
import wiki, { PageListTreeNode } from "@services/external/wiki";

import { Route } from "@hackembot/core/decorators";

import HackerEmbassyBot from "../core/classes/HackerEmbassyBot";
import { formatMonospaced, OptionalParam } from "../core/helpers";
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

export default class WikiController implements BotController {
    @Route(["wiki", "w", "wcat"], OptionalParam(/(\S+)/), match => [match[1]])
    static async wikiHandler(bot: HackerEmbassyBot, msg: Message, pagename?: string) {
        try {
            if (!pagename) {
                await bot.sendMessageExt(msg.chat.id, t("wiki.help"), msg);
                return;
            }

            const page = await wiki.findPage(pagename);

            if (!page) {
                await bot.sendMessageExt(msg.chat.id, t("wiki.page.notfound", { pagename }), msg);
                return;
            }

            const content = await wiki.getPageContent(page.id);

            if (!content) {
                await bot.sendMessageExt(msg.chat.id, t("wiki.page.notfound", { pagename }), msg);
                return;
            }

            await bot.sendLongMessage(msg.chat.id, content, msg, {
                parse_mode: "GFM",
                baseUrl: wiki.baseUrl,
            });
        } catch (error) {
            await bot.sendMessageExt(msg.chat.id, t("wiki.general.errors.generic"), msg);
            logger.error(error);
        }
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
