// The real service talks to a hosted Outline instance over HTTP (and imports node-fetch at module
// scope, which trips Jest's transform if pulled in eagerly - see tests/mocks/embassy.ts for the
// same issue). This stand-in never touches the network; tests configure the jest.fn() return
// values directly for the scenarios they care about.
//
// Only covers what wikiHandler (/wiki) needs. If tests start covering wikiTreeHandler
// (/wikitree), it'll also need a nodePath mock.
export function createWikiMock() {
    return {
        __esModule: true,
        default: {
            baseUrl: "https://wiki.test",
            listPagesAsTree: jest.fn().mockResolvedValue([]),
            findTreeNode: jest.fn(async () => {}),
            getPageContent: jest.fn(async () => {}),
            getSourceUrl: jest.fn(async () => {}),
            resolveAttachmentUrl: jest.fn(async () => {}),
        },
    };
}
