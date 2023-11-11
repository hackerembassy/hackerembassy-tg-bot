export class OptionalRegExp extends RegExp {}

export function OptionalParam(paramregex: RegExp) {
    return new OptionalRegExp(`(?: ${paramregex.source})?`, paramregex.flags);
}
