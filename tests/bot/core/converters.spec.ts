import {
    GFMToTelegramMarkdown,
    stripCustomMarkup,
    stripThinkingScope,
    taggedMarkdownToTelegramMarkdownV2,
    toEscapedTelegramMarkdown,
} from "@hackembot/core/converters";
import { ZERO_WIDTH_SPACE } from "@hackembot/core/constants";

describe("taggedMarkdownToTelegramMarkdownV2", () => {
    it("escapes untagged markdown-special characters as literal text", () => {
        expect(taggedMarkdownToTelegramMarkdownV2("a.b")).toBe("a\\.b");
    });

    it("turns a #-tagged pair of special characters into real MarkdownV2 markup", () => {
        expect(taggedMarkdownToTelegramMarkdownV2("#*bold#*")).toBe("*bold*");
    });

    it("escapes untagged specials while leaving #-tagged ones as real markup in the same string", () => {
        expect(taggedMarkdownToTelegramMarkdownV2("#*b#* x-y")).toBe("*b* x\\-y");
    });

    it("un-escapes a literal \\u0023 sequence into an escaped hash", () => {
        expect(taggedMarkdownToTelegramMarkdownV2("a\\u0023b")).toBe("a\\#b");
    });
});

describe("stripCustomMarkup", () => {
    it("removes each #-tag marker together with the character it tags", () => {
        expect(stripCustomMarkup("#*bold#*")).toBe("bold");
    });

    it("leaves a trailing # with nothing after it untouched", () => {
        expect(stripCustomMarkup("abc#")).toBe("abc#");
    });
});

describe("stripThinkingScope", () => {
    it("removes a thinking-scope block including its markers", () => {
        const scoped = `[thinking]\nsome reasoning\n[/${ZERO_WIDTH_SPACE}thinking]\n\n`;

        expect(stripThinkingScope(`intro\n${scoped}final answer`)).toBe("intro\nfinal answer");
    });

    it("leaves text with no thinking scope unchanged", () => {
        expect(stripThinkingScope("plain text")).toBe("plain text");
    });
});

describe("GFMToTelegramMarkdown", () => {
    it("escapes stray MarkdownV2-special characters in plain prose", () => {
        expect(GFMToTelegramMarkdown("a.b")).toBe("a\\.b");
    });

    it("keeps inline code verbatim, unescaped", () => {
        expect(GFMToTelegramMarkdown("`a_b`")).toBe("`a_b`");
    });

    it("keeps a fenced code block verbatim and drops the language tag", () => {
        const input = "```js\nconst x = 1_000;\n```";

        expect(GFMToTelegramMarkdown(input)).toBe("```\nconst x = 1_000;\n```");
    });

    it("turns a heading into bold text, stripping redundant nested bold", () => {
        expect(GFMToTelegramMarkdown("# Hello **World**")).toBe("*Hello World*");
    });

    it("turns a list marker into a bullet", () => {
        expect(GFMToTelegramMarkdown("- item one\n- item two")).toBe("• item one\n• item two");
    });

    it("resolves a relative link against baseUrl", () => {
        expect(GFMToTelegramMarkdown("[docs](/guide)", "https://wiki.example.com")).toBe(
            "[docs](https://wiki.example.com/guide)"
        );
    });

    it("turns an image into a captioned link resolved against baseUrl", () => {
        expect(GFMToTelegramMarkdown("![alt text](/img.png)", "https://x.com")).toBe("[🖼 alt text](https://x.com/img.png)");
    });

    it("renders a thinking-scope block as an expandable blockquote", () => {
        const input = `[thinking]\nstep one\nstep two\n[/${ZERO_WIDTH_SPACE}thinking]\n\nAnswer`;

        expect(GFMToTelegramMarkdown(input)).toBe("**>step one\n>step two||\n\nAnswer");
    });

    it("drops an empty thinking-scope block entirely", () => {
        const input = `[thinking]\n   \n[/${ZERO_WIDTH_SPACE}thinking]\n\nAnswer`;

        expect(GFMToTelegramMarkdown(input)).toBe("Answer");
    });

    it("normalizes literal \\n sequences from some sources into real newlines", () => {
        expect(GFMToTelegramMarkdown("line one\\nline two")).toBe("line one\nline two");
    });

    it("collapses 3+ consecutive blank lines into a single blank line", () => {
        expect(GFMToTelegramMarkdown("first\n\n\n\nsecond")).toBe("first\n\nsecond");
    });
});

describe("toEscapedTelegramMarkdown", () => {
    it("converts a plain link into a #-tagged MarkdownV2 link", () => {
        expect(toEscapedTelegramMarkdown('<a href="https://example.com">click here</a>')).toBe(
            "#[click here#]#(https://example.com#)"
        );
    });

    it("strips the scheme from t.me links, and the leading t.me/ from a label that's just the link", () => {
        expect(toEscapedTelegramMarkdown('<a href="https://t.me/somechat">https://t.me/somechat</a>')).toBe(
            "#[somechat#]#(t.me/somechat#)"
        );
    });
});
