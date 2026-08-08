import { NodeHtmlMarkdown } from "node-html-markdown";

/**
 * Bot uses MarkdownV2 by default, because it's needed for almost every command.
 * But we still want to be able to use markdown special symbols as regular symbols in some cases.
 * To allow this we prefix these symbols with # when we need them to be used as markup - this is the
 * bot's own "tagged" dialect, converted here into real Telegram MarkdownV2.
 * @param message where functional markup symbols are escaped with #
 * @returns string where these are converted to a usual Markdownv2 format
 */
export function taggedMarkdownToTelegramMarkdownV2(message: string): string {
    return message
        .replaceAll(/((?<![\\|#])[_*[\]()~`>+\-=|{}.!])/g, "\\$1")
        .replaceAll(/#([_*[\]()~`>+\-=|{}.!])/g, "$1")
        .replaceAll("#", "")
        .replaceAll("\\u0023", "\\#");
}

/**
 * @param text which can have html tags
 * @returns string in Markdownv2 format where all markdown tags are escaped with # symbol
 */
export function toEscapedTelegramMarkdown(text: string): string {
    return NodeHtmlMarkdown.translate(text, {
        useInlineLinks: false,
        strongDelimiter: "#*",
        emDelimiter: "#_",
    })
        .replaceAll(/https?:\/\/t\.me/g, "t.me")
        .replaceAll(/\[t\.me\/(.*?)\]/g, "[$1]")
        .replaceAll(/\[(.*?)\]\((.*?)\)/g, "#[$1#]#($2#)")
        .replaceAll("%5F", "_");
}

export function stripCustomMarkup(text: string): string {
    return text.replaceAll(/#./g, "");
}

// Telegram's legacy Markdown parser scans the *whole* message for these 4 delimiter characters and
// pairs them up; a single stray one anywhere (e.g. "path_in_container" outside of a code span) makes
// the pair count odd and the entire message gets rejected with "can't find end of the entity" - not
// just that one spot. So anything not deliberately built into an entity below must be escaped.
function escapeTelegramMarkdownSpecials(text: string): string {
    return text.replaceAll(/[_*`[]/g, "\\$&");
}

// Marks text that's already a finished Telegram entity (or is otherwise safe/literal, like code) so
// later passes - including the final blanket escape - don't touch it again. Uses a Private Use Area
// character, which can't appear in real content and won't collide with plain digits in prose.
const ENTITY_PLACEHOLDER_MARK = "";
const ENTITY_PLACEHOLDER_REGEX = new RegExp(`${ENTITY_PLACEHOLDER_MARK}(\\d+)${ENTITY_PLACEHOLDER_MARK}`, "g");

function resolveRelativeUrl(url: string, baseUrl: string = ""): string {
    if (!baseUrl) return url;

    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;

    return `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
}

// Converts CommonMark/GFM into Telegram's legacy "Markdown" parse mode text, resolving any relative
// links/images against baseUrl so they're actually clickable.
// Every capture group below excludes "\n", so every entity this produces is confined to a single
// line - except fenced code blocks, which are the one deliberately multi-line entity.
export function GFMToTelegramMarkdown(markdown: string, baseUrl: string = ""): string {
    const protectedEntities: string[] = [];
    const protect = (entity: string): string => {
        protectedEntities.push(entity);
        return `${ENTITY_PLACEHOLDER_MARK}${protectedEntities.length - 1}${ENTITY_PLACEHOLDER_MARK}`;
    };

    const text = markdown
        // Some sources export literal "\n" instead of real line breaks; the regexes below match on actual newlines
        .replaceAll("\\n", "\n")
        // Fenced/inline code is taken verbatim and protected, since it's the one place stray
        // specials (e.g. a real "_" in example code) are meant to stay literal, not get escaped
        .replaceAll(/```[a-zA-Z0-9]*\n([\s\S]*?)```/g, (_, code: string) => protect(`\`\`\`\n${code}\`\`\``))
        .replaceAll(/`([^`\n]+)`/g, (_, code: string) => protect(`\`${code}\``))
        // Images have no entity in Telegram Markdown, so turn them into a captioned, absolute-URL link
        .replaceAll(/!\[([^\]\n]*)\]\(([^)\s]+)[^)]*\)/g, (_, alt: string, url: string) =>
            protect(`[🖼 ${escapeTelegramMarkdownSpecials(alt || "Image")}](${resolveRelativeUrl(url, baseUrl)})`)
        )
        // Relative links won't be clickable, so they're resolved against baseUrl
        .replaceAll(/\[([^\]\n]+)\]\(([^)\s]+)[^)]*\)/g, (_, label: string, url: string) =>
            protect(`[${escapeTelegramMarkdownSpecials(label)}](${resolveRelativeUrl(url, baseUrl)})`)
        )
        // No heading entity exists, so bold the line instead of showing a literal leading "#"
        .replaceAll(/^#{1,6}[ \t]+(.+)$/gm, (_, heading: string) =>
            protect(`*${escapeTelegramMarkdownSpecials(heading.trim())}*`)
        )
        // A line starting with "* "/"- " looks like an unclosed bold delimiter to Telegram's parser
        .replaceAll(/^(\s*)[-*+][ \t]+/gm, "$1• ")
        // Legacy Markdown's bold delimiter is a single "*", not "**"/"__"
        .replaceAll(/\*\*([^*\n]+)\*\*/g, (_, bold: string) => protect(`*${escapeTelegramMarkdownSpecials(bold)}*`))
        .replaceAll(/__([^_\n]+)__/g, (_, bold: string) => protect(`*${escapeTelegramMarkdownSpecials(bold)}*`))
        // No strikethrough entity exists, so just drop the tildes instead of showing them literally
        .replaceAll(/~~([^~]+)~~/g, "$1");

    // Everything left at this point is plain prose - escape any stray entity-delimiter characters
    // in it (see escapeTelegramMarkdownSpecials), then restore the protected entities from above.
    return escapeTelegramMarkdownSpecials(text).replaceAll(
        ENTITY_PLACEHOLDER_REGEX,
        (_, i: string) => protectedEntities[Number(i)]
    );
}
