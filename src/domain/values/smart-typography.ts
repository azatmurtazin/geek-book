// Smart typography: straight quotes to curly ones, and `--`/`---` to dashes.
//
// The string form here is what a reader that holds raw source uses — the
// linter's headings, most of all — and what the token walk in
// `lib/smart-typography.ts` calls for each run of prose. The walk itself stays
// there until the print and web editions share a neutral tree; only the pure
// quote/dash engine lives here.
//
// The string form steps over an inline code span, so a heading that names a flag
// in backticks still slugs the same on both sides. Pure: no imports outside
// `domain/`.

const OPEN_DOUBLE = "\u201c";
const CLOSE_DOUBLE = "\u201d";
const OPEN_SINGLE = "\u2018";
const CLOSE_SINGLE = "\u2019";
const EN_DASH = "\u2013";
const EM_DASH = "\u2014";

const WORD = /[\p{L}\p{N}]/u;

/** Whether a quote here opens: at the start of a run, after a space, after an
 *  opening bracket, or after a dash or an opening quote. Everywhere else — most
 *  of all after a word — it closes. */
function opensQuote(prev: string): boolean {
  if (prev === "") return true;
  return (
    /[\s([{<]/.test(prev) ||
    prev === EN_DASH ||
    prev === EM_DASH ||
    prev === OPEN_DOUBLE ||
    prev === OPEN_SINGLE
  );
}

/** The last character of `text`, "" when it is empty. */
export function lastChar(text: string): string {
  return text.length ? text[text.length - 1] : "";
}

/**
 * Smartpunctuate one run of text, reading `prev` as the character before it.
 * Returns the text and the character it ends on, so a caller can carry the
 * context into the next token.
 */
export function run(text: string, prev: string): { text: string; next: string } {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "`") {
      // An inline code span is not prose: copy it verbatim, but let the run
      // carry on from its last character, as the token walk does.
      let ticks = 1;
      while (text[i + ticks] === "`") ticks++;
      const close = text.indexOf("`".repeat(ticks), i + ticks);
      if (close === -1) {
        out += ch;
        prev = ch;
        continue;
      }
      out += text.slice(i, close + ticks);
      prev = lastChar(text.slice(i + ticks, close));
      i = close + ticks - 1;
    } else if (ch === "-" && text[i + 1] === "-") {
      // `---` is an em dash, `--` an en dash; three marks win over two.
      const em = text[i + 2] === "-";
      prev = em ? EM_DASH : EN_DASH;
      out += prev;
      i += em ? 2 : 1;
    } else if (ch === '"') {
      prev = opensQuote(prev) ? OPEN_DOUBLE : CLOSE_DOUBLE;
      out += prev;
    } else if (ch === "'") {
      // An apostrophe is a right single quote: within a word (`don't`), after a
      // digit, or before one (a decade, `'90s`). Otherwise it is a quote.
      const digit = text[i + 1] !== undefined && /\d/.test(text[i + 1]);
      prev = WORD.test(prev) || digit ? CLOSE_SINGLE : opensQuote(prev) ? OPEN_SINGLE : CLOSE_SINGLE;
      out += prev;
    } else {
      out += ch;
      prev = ch;
    }
  }
  return { text: out, next: prev };
}

/** Smartpunctuate `text` as one run — for a reader that holds raw source, like
 *  the linter's headings, rather than marked's tokens. */
export function smartTypography(text: string): string {
  return run(text, "").text;
}
