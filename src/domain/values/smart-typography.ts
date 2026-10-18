// Smart typography: straight quotes to curly ones, and `--`/`---` to dashes.
//
// The string form here is what a reader that holds raw source uses — the
// linter's headings, most of all — and the neutral-tree walk at the bottom is
// what the printed edition calls for each run of prose. The web edition walks
// `marked`'s own tokens (`lib/smart-typography.ts`) until it shares the neutral
// tree; both call the one quote/dash engine here, so the two editions cannot
// disagree.
//
// The string form steps over an inline code span, so a heading that names a flag
// in backticks still slugs the same on both sides. Pure: no imports outside
// `domain/`.

import type { MdInline, MdNode } from "../model/markdown.js";

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

/**
 * Smartpunctuate the inline text of a neutral document, in place. Code, link
 * targets, image alt text and raw HTML are left as written; each paragraph,
 * heading and table cell starts a fresh run. Text a backslash escaped is the
 * reader's own punctuation, so it is stepped over as the code spans are.
 */
export function applySmartTypography(nodes: readonly MdNode[]): void {
  for (const node of nodes) {
    smartenNode(node);
  }
}

function smartenNode(node: MdNode): void {
  switch (node.type) {
    case "paragraph":
    case "heading":
    case "text":
      runOf(node.inline, "");
      break;
    case "table":
      for (const cell of node.header) runOf(cell, "");
      for (const row of node.rows) {
        for (const cell of row) runOf(cell, "");
      }
      break;
    case "blockquote":
      applySmartTypography(node.children);
      break;
    case "list":
      for (const item of node.items) applySmartTypography(item);
      break;
    default:
      break;
  }
}

/** Smartpunctuate one inline run, carrying the last character from node to
 *  node so a quote that wraps emphasis closes where it should. */
function runOf(nodes: readonly MdInline[], prev: string): string {
  for (const node of nodes) prev = smartenInline(node, prev);
  return prev;
}

function smartenInline(node: MdInline, prev: string): string {
  switch (node.type) {
    case "text": {
      if (node.verbatim) {
        return lastChar(node.text);
      }
      const smart = run(node.text, prev);
      node.text = smart.text;
      return smart.next;
    }
    // Code and raw HTML are the reader's characters, not the typographer's; a
    // run continues past them as it would past any glyph.
    case "code":
    case "html":
      return lastChar(node.text);
    case "break":
      return " ";
    // Emphasis and links are transparent: their text belongs to the same run.
    case "link":
    case "strong":
    case "em":
    case "del":
      return runOf(node.children, prev);
    // Image alt text is not prose the reader reads here.
    case "image":
      return prev;
  }
}
