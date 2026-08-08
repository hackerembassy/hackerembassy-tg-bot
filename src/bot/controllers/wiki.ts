import { Message } from "node-telegram-bot-api";

import logger from "@services/common/logger";
import wiki, { PageListTreeNode } from "@services/external/wiki";

import { Route } from "@hackembot/core/decorators";

import HackerEmbassyBot from "../core/classes/HackerEmbassyBot";
import { formatMonospaced, OptionalParam } from "../core/helpers";
import t from "../core/localization";
import { BotController } from "../core/types";

type WikiPage = {
    id: string;
    path: string;
    title: string;
};

function nodePath(node: PageListTreeNode, parentPath: string): string {
    const segment = node.segment ?? String(node.id ?? "");

    return parentPath ? `${parentPath}/${segment}` : segment;
}

function flattenWikiTree(nodes: PageListTreeNode[], parentPath = ""): WikiPage[] {
    const pages: WikiPage[] = [];

    for (const node of nodes) {
        const path = nodePath(node, parentPath);

        if (node.id && node.title) pages.push({ id: String(node.id), path, title: node.title });

        pages.push(...flattenWikiTree(node.children, path));
    }

    return pages;
}

function findWikiPage(pages: WikiPage[], query: string): Optional<WikiPage> {
    const normalized = query
        .trim()
        .replaceAll(/^\/+|\/+$/g, "")
        .toLowerCase();

    return (
        pages.find(page => page.path.toLowerCase() === normalized) ??
        pages.find(page => page.path.toLowerCase().endsWith(`/${normalized}`)) ??
        pages.find(page => page.title.toLowerCase() === normalized)
    );
}

function renderWikiTree(nodes: PageListTreeNode[], parentPath = "", prefix = ""): string[] {
    const lines: string[] = [];

    for (const [index, node] of nodes.entries()) {
        const isLast = index === nodes.length - 1;
        const branch = isLast ? "└─ " : "├─ ";
        const childPrefix = prefix + (isLast ? "    " : "│   ");
        const path = nodePath(node, parentPath);

        lines.push(`${prefix}${branch}${formatMonospaced(path)}`);
        if (node.title) lines.push(`${childPrefix}— ${node.title}`);

        lines.push(...renderWikiTree(node.children, path, childPrefix));
    }

    return lines;
}

export default class WikiController implements BotController {
    @Route(["wiki"], OptionalParam(/(\S+)/), match => [match[1]])
    static async wikiHandler(bot: HackerEmbassyBot, msg: Message, pagename?: string) {
        try {
            if (!pagename) {
                await bot.sendMessageExt(msg.chat.id, t("wiki.help"), msg);
                return;
            }

            const tree = await wiki.listPagesAsTree();
            const page = findWikiPage(flattenWikiTree(tree), pagename);

            if (!page) {
                await bot.sendMessageExt(msg.chat.id, t("wiki.page.notfound", { pagename }), msg);
                return;
            }

            const content = await wiki.getPageContent(page.id);

            await bot.sendLongMessage(msg.chat.id, content, msg, { parse_mode: "" });
        } catch (error) {
            await bot.sendMessageExt(msg.chat.id, t("wiki.general.errors.generic"), msg);
            logger.error(error);
        }
    }

    @Route(["wikitree", "wikilist"])
    static async wikiTreeHandler(bot: HackerEmbassyBot, msg: Message) {
        try {
            const tree = await wiki.listPagesAsTree();
            const lines = renderWikiTree(tree);

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
