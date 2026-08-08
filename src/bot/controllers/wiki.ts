import { Message } from "node-telegram-bot-api";

import logger from "@services/common/logger";
import wiki, { PageListTreeNode } from "@services/external/wiki";

import { Route } from "@hackembot/core/decorators";

import HackerEmbassyBot from "../core/classes/HackerEmbassyBot";
import { formatMonospaced, OptionalParam } from "../core/helpers";
import t from "../core/localization";
import { BotController } from "../core/types";

function renderWikiTree(nodes: PageListTreeNode[], parentPath = "", prefix = ""): string[] {
    const lines: string[] = [];

    for (const [index, node] of nodes.entries()) {
        const isLast = index === nodes.length - 1;
        const branch = isLast ? "└─ " : "├─ ";
        const childPrefix = prefix + (isLast ? "    " : "│   ");
        const path = wiki.nodePath(node, parentPath);

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

            const page = await wiki.findPage(pagename);

            if (!page) {
                await bot.sendMessageExt(msg.chat.id, t("wiki.page.notfound", { pagename }), msg);
                return;
            }

            const content = await wiki.getPageContent(page.id, "telegram");

            if (!content) {
                await bot.sendMessageExt(msg.chat.id, t("wiki.page.notfound", { pagename }), msg);
                return;
            }

            await bot.sendLongMessage(msg.chat.id, content, msg, {
                parse_mode: "Markdown",
                link_preview_options: { is_disabled: true },
            });
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
