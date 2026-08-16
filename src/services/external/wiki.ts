import { createHmac, timingSafeEqual } from "node:crypto";

import config from "config";
import fetch from "node-fetch";
import memoize from "memoizee";

import { BotApiConfig, WikiConfig } from "@config";

import { MINUTE } from "@utils/date";

const wikiConfig = config.get<WikiConfig>("wiki");
const apiConfig = config.get<BotApiConfig>("api");

export type PageResponse = {
    pages: {
        single: {
            title: string;
            path: string;
            description: string;
            content: string;
            render: string;
        };
    };
};

type PageListItem = {
    id: number;
    title: string;
    path: string;
};

export type PageListTreeNode = {
    id?: number;
    segment?: string;
    title?: string;
    label?: string;
    url?: string;
    children: PageListTreeNode[];
};

export type WikiPage = {
    id: string;
    path: string;
    title: string;
};

export type PageListResponse = {
    pages: {
        list: PageListItem[];
    };
};

export type OutlineWebhookPayload = {
    id: string;
    actorId: string;
    webhookSubscriptionId: string;
    createdAt: string;
    event: string;
    payload: {
        id: string;
        model: {
            id: string;
            url: string;
            urlId: string;
            title: string;
            data: {
                type: string;
                content: Array<{
                    type: string;
                    content: Array<{
                        text: string;
                        type: string;
                    }>;
                }>;
            };
            text: string;
            icon: string;
            color: string;
            tasks: {
                completed: number;
                total: number;
            };
            createdAt: string;
            createdBy: {
                id: string;
                name: string;
                avatarUrl: string;
                color: string;
                role: string;
                isSuspended: boolean;
                createdAt: string;
                updatedAt: string;
                lastActiveAt: string;
                timezone: string;
            };
            updatedAt: string;
            updatedBy: {
                id: string;
                name: string;
                avatarUrl: string;
                color: string;
                role: string;
                isSuspended: boolean;
                createdAt: string;
                updatedAt: string;
                lastActiveAt: string;
                timezone: string;
            };
            publishedAt: string;
            archivedAt: string;
            deletedAt: string;
            collaboratorIds: Array<string>;
            revision: number;
            fullWidth: boolean;
            collectionId: string;
            parentDocumentId: string;
            isCollectionDeleted: boolean;
            templateId: string;
            template: boolean;
            insightsEnabled: boolean;
        };
    };
};

/** @deprecated */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class WikiJs {
    private endpoint: string;
    private token?: string;
    private defaultLocale?: string;

    constructor(endpoint: string, defaultLocale: string, token?: string) {
        this.endpoint = endpoint;
        this.token = token;
        this.defaultLocale = defaultLocale;
    }

    async listPages(locale?: string): Promise<PageListItem[]> {
        const data = (await this.wikiRequest(
            `query {
                            pages {
                                list (locale: "${locale ?? this.defaultLocale}") {
                                    id
                                    title
                                    path
                                }
                            }
                        }`,
            false
        )) as PageListResponse;

        return data.pages.list;
    }

    async listPagesAsTree(locale?: string): Promise<PageListTreeNode[]> {
        const list = await this.listPages(locale);
        const tree = this.combineItemsIntoTree(list);

        return tree;
    }

    async getPage(pageId: number) {
        const data = (await this.wikiRequest(
            `query {
            pages {
                single (id: ${pageId}) {
                    title
                    path
                    description
                    content
                    render
                }
            }
        }`
        )) as PageResponse;

        return data.pages.single;
    }

    private async wikiRequest(query: string, useToken = true) {
        if (useToken && !this.token) throw new Error("No token provided");

        const response = await fetch(this.endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: useToken ? "Bearer " + this.token : "",
            },
            body: JSON.stringify({
                query: query,
            }),
        });

        const body = (await response.json()) as { data: unknown };

        return body.data;
    }

    private combineItemsIntoTree(items: PageListItem[]): PageListTreeNode[] {
        const tree: PageListTreeNode = { children: [] };

        for (const item of items) {
            const pathSegments = item.path.split("/");
            let currentNode = tree;

            for (const segment of pathSegments) {
                let newNode = currentNode.children.find(c => c.segment === segment);
                if (!newNode) {
                    newNode = { segment, children: [] };
                    currentNode.children.push(newNode);
                }
                currentNode = newNode;
            }

            currentNode.id = item.id;
            currentNode.title = item.title;
        }

        return tree.children;
    }
}

class OutlineWiki {
    private static readonly CALLOUT_EMOJI: Record<string, string> = {
        warning: "⚠️",
        info: "ℹ️",
        note: "ℹ️",
        tip: "💡",
        danger: "🚫",
        error: "🚫",
    };

    private apiEndpoint: string;
    private wikiBaseUrl: string;
    private token: string;
    private publicCollectionId: string;
    private publicUrl: string;
    private shareSlug: string;

    constructor(baseUrl: string, publicCollectionId: string, token: string, publicUrl: string, shareSlug: string) {
        this.apiEndpoint = `${baseUrl}/api/`;
        this.wikiBaseUrl = baseUrl;
        this.token = token;
        this.publicCollectionId = publicCollectionId;
        this.publicUrl = publicUrl;
        this.shareSlug = shareSlug;
    }

    public get baseUrl(): string {
        return this.wikiBaseUrl;
    }

    public async listPagesAsTree(): Promise<PageListTreeNode[]> {
        const data = (await this.wikiRequest("collections.documents", {
            id: this.publicCollectionId,
        })) as PageListTreeNode[];

        for (const node of data) this.setSegmentRecursive(node);

        return data[0].children;
    }

    public async getPageContent(pageId: string): Promise<Optional<string>> {
        const isPublic = await this.isInPublicCollection(pageId);

        if (!isPublic) return null;

        const markdown = (await this.wikiRequest("documents.export", { id: pageId })) as string;

        return this.rewriteAttachmentUrls(this.rewriteCallouts(markdown));
    }

    // Outline's exported markdown embeds images as relative "/api/attachments.redirect?id=<GUID>"
    // links, which redirect to a signed storage URL that eventually expires. Rewriting them to our
    // own proxy (see resolveAttachmentUrl) means the link Telegram users see never goes stale, since
    // it's re-resolved fresh on every click instead of being baked in at export time.
    // The "sig" param proves this id was signed by rewriteAttachmentUrls for a page that already
    // passed isInPublicCollection - Outline has no "attachments.info" API to re-check this by id
    // alone, so we verify our own signature instead of asking Outline.
    public async resolveAttachmentUrl(attachmentId: string, signature: string): Promise<Optional<string>> {
        if (!this.isValidAttachmentSignature(attachmentId, signature)) return undefined;

        const response = await fetch(`${this.apiEndpoint}attachments.redirect?id=${attachmentId}`, {
            redirect: "manual",
            headers: { Authorization: `Bearer ${this.token}` },
        });

        return response.headers.get("location") ?? undefined;
    }

    public async findPage(query: string): Promise<Optional<WikiPage>> {
        const tree = await this.listPagesAsTree();

        return this.findWikiPage(this.flattenWikiTree(tree), query);
    }

    public async findTreeNode(query: string): Promise<Optional<{ node: PageListTreeNode; path: string }>> {
        const tree = await this.listPagesAsTree();
        const byId = this.findNodeById(tree, query, "");

        if (byId) return byId;

        const page = this.findWikiPage(this.flattenWikiTree(tree), query);

        return page ? this.findNodeById(tree, page.id, "") : undefined;
    }

    // The tree's own node.url is Outline's internal "/doc/..." route, which forces a login. The
    // public, no-login link just inserts the public collection's share slug ("/s/<slug>") before
    // that same path - e.g. "/doc/foo" -> "/s/main/doc/foo".
    public async getSourceUrl(pageId: string): Promise<Optional<string>> {
        const tree = await this.listPagesAsTree();
        const found = this.findNodeById(tree, pageId, "");

        return found?.node.url ? `${this.wikiBaseUrl}/s/${this.shareSlug}${found.node.url}` : undefined;
    }

    // Collection membership rarely changes, so this is memoized to avoid redoing the work
    private isInPublicCollection = memoize(
        async (pageId: string): Promise<boolean> => {
            const documentInfo = (await this.wikiRequest("documents.info", { id: pageId })) as { collectionId?: string };

            return documentInfo.collectionId === this.publicCollectionId;
        },
        { maxAge: MINUTE, promise: true }
    );

    private signAttachmentId(attachmentId: string): string {
        return createHmac("sha256", this.token).update(attachmentId).digest("hex").slice(0, 16);
    }

    private isValidAttachmentSignature(attachmentId: string, signature: string): boolean {
        const expected = Buffer.from(this.signAttachmentId(attachmentId));
        const actual = Buffer.from(signature);

        return expected.length === actual.length && timingSafeEqual(expected, actual);
    }

    private rewriteAttachmentUrls(markdown: string): string {
        return markdown.replaceAll(
            /\/api\/attachments\.redirect\?id=([0-9a-f-]{36})/gi,
            (_, id: string) => `${this.publicUrl}/api/wiki/attachment/${id}?sig=${this.signAttachmentId(id)}`
        );
    }

    // Outline's ":::type ... :::" callout containers aren't CommonMark, so GFMToTelegramMarkdown
    // doesn't know about them - normalize them here into plain "> "-prefixed blockquote lines (with
    // a type emoji standing in for the coloring/icon Telegram can't render), which the generic
    // converter already turns into a real Telegram blockquote entity.
    private rewriteCallouts(markdown: string): string {
        return markdown.replaceAll(/^:::(\w+)\n([\s\S]*?)\n:::$/gm, (_, type: string, body: string) => {
            const emoji = OutlineWiki.CALLOUT_EMOJI[type.toLowerCase()] ?? "📌";

            return body
                .split("\n")
                .map((line, i) => `> ${i === 0 ? `${emoji} ` : ""}${line}`)
                .join("\n");
        });
    }

    public nodePath(node: PageListTreeNode, parentPath: string): string {
        const segment = node.segment ?? String(node.id ?? "");

        return parentPath ? `${parentPath}/${segment}` : segment;
    }

    private flattenWikiTree(nodes: PageListTreeNode[], parentPath = ""): WikiPage[] {
        const pages: WikiPage[] = [];

        for (const node of nodes) {
            const path = this.nodePath(node, parentPath);

            if (node.id && node.title) pages.push({ id: String(node.id), path, title: node.title });

            pages.push(...this.flattenWikiTree(node.children, path));
        }

        return pages;
    }

    private findWikiPage(pages: WikiPage[], query: string): Optional<WikiPage> {
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

    private findNodeById(
        nodes: PageListTreeNode[],
        id: string,
        parentPath: string
    ): Optional<{ node: PageListTreeNode; path: string }> {
        for (const node of nodes) {
            const path = this.nodePath(node, parentPath);

            if (String(node.id) === id) return { node, path };

            const found = this.findNodeById(node.children, id, path);

            if (found) return found;
        }

        return undefined;
    }

    private setSegmentRecursive(node: PageListTreeNode) {
        node.segment = node.url?.slice(node.url.lastIndexOf("/") + 1, node.url.lastIndexOf("-"));
        node.label = node.title ?? node.segment ?? String(node.id ?? "?");
        for (const child of node.children) this.setSegmentRecursive(child);
    }

    private async wikiRequest(query: string, body: unknown, useToken = true) {
        if (useToken && !this.token) throw new Error("No token provided");

        const response = await fetch(this.apiEndpoint + query, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: useToken ? "Bearer " + this.token : "",
            },
            body: JSON.stringify(body),
        });

        const responseBody = (await response.json()) as { data: unknown };

        return responseBody.data;
    }
}

export default new OutlineWiki(
    wikiConfig.baseUrl,
    wikiConfig.publicCollectionId,
    process.env["WIKIAPIKEY"] ?? "",
    apiConfig.publicUrl,
    wikiConfig.shareSlug
);
