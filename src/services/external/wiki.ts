import config from "config";
import fetch from "node-fetch";

import { WikiConfig } from "@config";

const wikiConfig = config.get<WikiConfig>("wiki");

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
    private apiEndpoint: string;
    private baseUrl: string;
    private token: string;
    private publicCollectionId: string;

    constructor(baseUrl: string, publicCollectionId: string, token: string) {
        this.apiEndpoint = `${baseUrl}/api/`;
        this.baseUrl = baseUrl;
        this.token = token;
        this.publicCollectionId = publicCollectionId;
    }

    public async listPagesAsTree(): Promise<PageListTreeNode[]> {
        const data = (await this.wikiRequest("collections.documents", {
            id: this.publicCollectionId,
        })) as PageListTreeNode[];

        for (const node of data) this.setSegmentRecursive(node);

        return data[0].children;
    }

    public async getPageContent(pageId: string, format: "raw" | "telegram" = "raw"): Promise<Optional<string>> {
        const isPublic = await this.isInPublicCollection(pageId);

        if (!isPublic) return null;

        const content = (await this.wikiRequest("documents.export", { id: pageId })) as string;

        return format === "telegram" ? this.outlineMarkdownToTelegram(content) : content;
    }

    public async findPage(query: string): Promise<Optional<WikiPage>> {
        const tree = await this.listPagesAsTree();

        return this.findWikiPage(this.flattenWikiTree(tree), query);
    }

    private async isInPublicCollection(pageId: string): Promise<boolean> {
        const documentInfo = (await this.wikiRequest("documents.info", { id: pageId })) as { collectionId?: string };

        return documentInfo.collectionId === this.publicCollectionId;
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

    private outlineMarkdownToTelegram(markdown: string): string {
        return (
            markdown
                // Required: Outline exports literal "\n" instead of real line breaks; the regexes below match on actual newlines
                .replaceAll("\\n", "\n")
                // Required: images have no entity in Telegram Markdown, so turn them into a captioned, absolute-URL link
                .replaceAll(
                    /!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g,
                    (_, alt: string, url: string) => `[🖼 ${alt || "Image"}](${this.resolveWikiUrl(url)})`
                )
                // Required: Outline links are often relative to the wiki instance, which Telegram won't linkify
                .replaceAll(
                    /\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g,
                    (_, label: string, url: string) => `[${label}](${this.resolveWikiUrl(url)})`
                )
                // Required: legacy Markdown's pre entity has no language tag syntax; drop it so it's not shown as a code line
                .replaceAll(/^```[a-zA-Z0-9]*\n/gm, "```\n")
                // Required: a line starting with "* "/"- " looks like an unclosed bold delimiter to Telegram's parser
                .replaceAll(/^(\s*)[-*+][ \t]+/gm, "$1• ")
                // Required: legacy Markdown's bold delimiter is a single "*", not "**"
                .replaceAll(/\*\*([^*]+)\*\*/g, "*$1*")
                // Required: same as above for GFM's double-underscore bold, which would otherwise read as italic
                .replaceAll(/__([^_]+)__/g, "*$1*")
                // Cosmetic: no strikethrough entity exists, so just drop the tildes instead of showing them literally
                .replaceAll(/~~([^~]+)~~/g, "$1")
                // Cosmetic: no heading entity exists, so bold the line instead of showing a literal leading "#"
                .replaceAll(/^#{1,6}[ \t]+(.+)$/gm, "*$1*")
        );
    }

    // Outline's exported links/images are commonly relative to the wiki instance (e.g. "/doc/..."),
    // which Telegram won't render as clickable without a scheme, so they're resolved to absolute URLs.
    private resolveWikiUrl(url: string): string {
        if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;

        return `${this.baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
    }

    private setSegmentRecursive(node: PageListTreeNode) {
        node.segment = node.url?.slice(node.url.lastIndexOf("/") + 1, node.url.lastIndexOf("-"));
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

export default new OutlineWiki(wikiConfig.baseUrl, wikiConfig.publicCollectionId, process.env["WIKIAPIKEY"] ?? "");
