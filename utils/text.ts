export const REPLACE_MARKER = "\x1a";
const ELLIPSIS = "...";

export function isEmoji(message: string): boolean {
    return /[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]/u.test(
        message
    );
}

export function equalsIns(str1: Nullable<string>, str2: Nullable<string>): boolean {
    return str1?.toLowerCase() === str2?.toLowerCase();
}

export function cropStringAtSpace(str: string, maxLength = 30) {
    if (str.length <= maxLength) return str;

    const shortenedStr = str.slice(0, maxLength - ELLIPSIS.length);
    const spaceIndex = shortenedStr.lastIndexOf(" ");

    if (spaceIndex !== -1) return shortenedStr.slice(0, spaceIndex);

    return shortenedStr + ELLIPSIS;
}

export function chunkSubstr(str: string, size: number) {
    const chunks = [];

    if (str.length < size) return [str];

    while (str.length > 0) {
        const tmp = str.substring(0, size);
        const indexOfLastNewLine = tmp.lastIndexOf("\n");
        const chunkLength = indexOfLastNewLine > 0 ? indexOfLastNewLine + 1 : size;
        chunks.push(tmp.substring(0, chunkLength));
        str = str.substring(chunkLength);
    }

    return chunks;
}
