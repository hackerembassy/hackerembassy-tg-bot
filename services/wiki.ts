import config from "config";

import { WikiConfig } from "../config/schema";

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
    children: PageListTreeNode[];
};

export type PageListResponse = {
    pages: {
        list: PageListItem[];
    };
};

class Wiki {
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

export default new Wiki(wikiConfig.endpoint, wikiConfig.defaultLocale, process.env["WIKIJSAPIKEY"]);
