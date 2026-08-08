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

// MarkdownV2 reserves these 18 characters as entity delimiters and requires literal occurrences to
// be escaped - unlike Telegram's legacy "Markdown" mode (which only documents 4, and turned out not
// to reliably support escaping a delimiter *inside* an entity of that same type, e.g. an escaped
// "\*" inside a "*bold*" span - see GFMToTelegramMarkdown's heading handling below). MarkdownV2's
// escape model is well-specified and two-phase (escapes are resolved before entities are scanned),
// so it doesn't have that failure mode.
function escapeTelegramMarkdownV2Specials(text: string): string {
    return text.replaceAll(/[_*[\]()~`>#+=|{}.!\\-]/g, "\\$&");
}

// Inside the (...) part of a link/image definition, MarkdownV2 only requires ')' and '\' to be
// escaped - anything else (including '.', '-', '_', '~', which commonly appear in real URLs) must
// stay untouched, or the escaped backslash would become part of the URL itself and break the link.
function escapeTelegramMarkdownV2Url(url: string): string {
    return url.replaceAll(/[)\\]/g, "\\$&");
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

// Converts CommonMark/GFM into Telegram MarkdownV2, resolving any relative links/images against
// baseUrl so they're actually clickable.
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
        // CommonMark's "<scheme:...>" autolink syntax has no Telegram entity of its own either, so
        // turn it into a real link instead of leaving the angle brackets as escaped literal text
        .replaceAll(/<([a-z][a-z0-9+.-]*:[^\s<>]+)>/gi, (_, url: string) =>
            protect(
                `[${escapeTelegramMarkdownV2Specials(url)}](${escapeTelegramMarkdownV2Url(resolveRelativeUrl(url, baseUrl))})`
            )
        )
        // Images have no entity in Telegram Markdown, so turn them into a captioned, absolute-URL link
        .replaceAll(/!\[([^\]\n]*)\]\(([^)\s]+)[^)]*\)/g, (_, alt: string, url: string) =>
            protect(
                `[🖼 ${escapeTelegramMarkdownV2Specials(alt || "Image")}](${escapeTelegramMarkdownV2Url(resolveRelativeUrl(url, baseUrl))})`
            )
        )
        // Relative links won't be clickable, so they're resolved against baseUrl
        .replaceAll(/\[([^\]\n]+)\]\(([^)\s]+)[^)]*\)/g, (_, label: string, url: string) =>
            protect(
                `[${escapeTelegramMarkdownV2Specials(label)}](${escapeTelegramMarkdownV2Url(resolveRelativeUrl(url, baseUrl))})`
            )
        )
        // No heading entity exists, so bold the line instead of showing a literal leading "#". Any
        // "**bold**"/"__bold__" nested inside the heading text is stripped rather than escaped - it's
        // already going to be bold from the heading wrapper, so escaping it would just leave literal
        // "**" characters visible around already-bold text instead of removing the redundant markup.
        .replaceAll(/^#{1,6}[ \t]+(.+)$/gm, (_, heading: string) => {
            const unwrapped = heading
                .trim()
                .replaceAll(/\*\*([^*\n]+)\*\*/g, "$1")
                .replaceAll(/__([^_\n]+)__/g, "$1");

            return protect(`*${escapeTelegramMarkdownV2Specials(unwrapped)}*`);
        })
        // A line starting with "* "/"- " looks like an unclosed bold delimiter to Telegram's parser
        .replaceAll(/^(\s*)[-*+][ \t]+/gm, "$1• ")
        // GFM's "**bold**"/"__bold__" both mean bold - map both to MarkdownV2's single-"*" bold,
        // rather than letting "__" fall through to MarkdownV2's (differently-meaning) underline
        .replaceAll(/\*\*([^*\n]+)\*\*/g, (_, bold: string) => protect(`*${escapeTelegramMarkdownV2Specials(bold)}*`))
        .replaceAll(/__([^_\n]+)__/g, (_, bold: string) => protect(`*${escapeTelegramMarkdownV2Specials(bold)}*`))
        // GFM's single-"*" means italic, which is single-"_" in MarkdownV2. GFM's single-"_" italic is
        // deliberately NOT handled the same way: unlike "*", underscores routinely appear inside plain
        // identifiers/URLs (e.g. "hacker_embassy"), and converting every "_..._" pair would misfire on
        // those, italicizing arbitrary word fragments instead of leaving them alone.
        .replaceAll(/\*([^*\n]+)\*/g, (_, italic: string) => protect(`_${escapeTelegramMarkdownV2Specials(italic)}_`))
        // MarkdownV2 has real strikethrough support, unlike legacy Markdown
        .replaceAll(/~~([^~\n]+)~~/g, (_, strike: string) => protect(`~${escapeTelegramMarkdownV2Specials(strike)}~`));

    // Everything left at this point is plain prose - escape any stray entity-delimiter characters
    // in it (see escapeTelegramMarkdownV2Specials), then restore the protected entities from above.
    return escapeTelegramMarkdownV2Specials(text).replaceAll(
        ENTITY_PLACEHOLDER_REGEX,
        (_, i: string) => protectedEntities[Number(i)]
    );
}
