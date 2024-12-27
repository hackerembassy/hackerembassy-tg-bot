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
            icon: any;
            color: any;
            tasks: {
                completed: number;
                total: number;
            };
            createdAt: string;
            createdBy: {
                id: string;
                name: string;
                avatarUrl: any;
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
                avatarUrl: any;
                color: string;
                role: string;
                isSuspended: boolean;
                createdAt: string;
                updatedAt: string;
                lastActiveAt: string;
                timezone: string;
            };
            publishedAt: string;
            archivedAt: any;
            deletedAt: any;
            collaboratorIds: Array<string>;
            revision: number;
            fullWidth: boolean;
            collectionId: string;
            parentDocumentId: any;
            isCollectionDeleted: boolean;
            templateId: any;
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

        const body = (await response.json()) as { data: any };

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
    private token: string;
    private publicCollectionId: string;

    constructor(baseUrl: string, publicCollectionId: string, token: string) {
        this.apiEndpoint = `${baseUrl}/api/`;
        this.token = token;
        this.publicCollectionId = publicCollectionId;
    }

    async listPagesAsTree(): Promise<PageListTreeNode[]> {
        const data = (await this.wikiRequest("collections.documents", {
            id: this.publicCollectionId,
        })) as PageListTreeNode[];

        data.forEach(node => this.setSegmentRecursive(node));

        return data[0].children;
    }

    async getPageContent(pageId: string) {
        return (await this.wikiRequest("documents.export", { id: pageId })) as PageResponse;
    }

    private setSegmentRecursive(node: PageListTreeNode) {
        node.segment = node.url?.slice(node.url.lastIndexOf("/") + 1, node.url.lastIndexOf("-"));
        node.children.forEach(child => this.setSegmentRecursive(child));
    }

    private async wikiRequest(query: string, body: any, useToken = true) {
        if (useToken && !this.token) throw new Error("No token provided");

        const response = await fetch(this.apiEndpoint + query, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: useToken ? "Bearer " + this.token : "",
            },
            body: JSON.stringify(body),
        });

        const responseBody = (await response.json()) as { data: any };

        return responseBody.data;
    }
}

export default new OutlineWiki(wikiConfig.baseUrl, wikiConfig.publicCollectionId, process.env["WIKIAPIKEY"] ?? "");
