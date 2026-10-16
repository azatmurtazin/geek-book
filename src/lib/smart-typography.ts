// Smart typography: straight quotes to curly ones, and `--`/`---` to dashes.
//
// A book that asks for it (see `markdown.smartTypography`) reads its prose with
// a typographer's punctuation on both editions. The change is made on the marked
// tokens, once, so the website and the PDF cannot disagree: `applySmartTypography`
// walks a document's inline text and leaves code, link targets and raw HTML
// alone. Each paragraph, heading and table cell is a fresh run, but the
// neighbouring character carries across inline tokens within one, so a pair of
// quotes that wraps emphasis still opens and closes (`"**bold**"`).
//
// The linter reads raw heading lines rather than tokens, so it calls the string
// form, `smartTypography`, on a heading before slugging it — reaching the same
// identifier the build gets from `slugify(plainText(tokens))`. The string form
// steps over an inline code span just as the walk does, so a heading that names
// a flag in backticks still slugs the same on both sides.

import type { Token, Tokens } from "marked";

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
function lastChar(text: string): string {
  return text.length ? text[text.length - 1] : "";
}

/**
 * Smartpunctuate one run of text, reading `prev` as the character before it.
 * Returns the text and the character it ends on, so a caller can carry the
 * context into the next token.
 */
function run(text: string, prev: string): { text: string; next: string } {
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

/**
 * Smartpunctuate the inline text of a document's tokens, in place. Code, link
 * targets, image alt text and raw HTML are left as written; each paragraph,
 * heading and table cell starts a fresh run.
 */
export function applySmartTypography(tokens: Token[]): void {
  for (const token of tokens) block(token);
}

function block(token: Token): void {
  switch (token.type) {
    case "paragraph":
    case "heading":
      runOf((token as Tokens.Paragraph | Tokens.Heading).tokens, "");
      break;
    case "table": {
      const table = token as Tokens.Table;
      for (const cell of table.header) runOf(cell.tokens, "");
      for (const row of table.rows) {
        for (const cell of row) runOf(cell.tokens, "");
      }
      break;
    }
    case "blockquote":
      applySmartTypography((token as Tokens.Blockquote).tokens);
      break;
    case "list":
      for (const item of (token as Tokens.List).items) applySmartTypography(item.tokens);
      break;
    case "text":
      runOf([token], "");
      break;
    default:
      break;
  }
}

/** Smartpunctuate one inline run, carrying the last character from token to
 *  token so a quote that wraps emphasis closes where it should. */
function runOf(tokens: Token[], prev: string): string {
  for (const token of tokens) prev = inline(token, prev);
  return prev;
}

function inline(token: Token, prev: string): string {
  switch (token.type) {
    case "text": {
      const text = token as Tokens.Text;
      if (text.tokens?.length) {
        return runOf(text.tokens, prev);
      }
      const smart = run(text.text, prev);
      text.text = smart.text;
      return smart.next;
    }
    // Code and raw HTML are the reader's characters, not the typographer's; a
    // run continues past them as it would past any glyph.
    case "codespan":
    case "escape":
    case "html":
      return lastChar((token as { text?: string }).text ?? "");
    case "br":
      return " ";
    // Emphasis and links are transparent: their text belongs to the same run.
    case "link":
    case "strong":
    case "em":
    case "del":
      return runOf((token as Tokens.Generic).tokens ?? [], prev);
    // Image alt text is not prose the reader reads here.
    case "image":
      return prev;
    default:
      {
        const children = (token as Tokens.Generic).tokens;
        return children ? runOf(children, prev) : prev;
      }
  }
}
