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
// The pure quote/dash engine lives in `domain/values/smart-typography.ts`; this
// is the legacy path and the token walk over marked's tree. The linter reads raw
// heading lines rather than tokens, so it calls the string form there directly.

import type { Token, Tokens } from "marked";
import { lastChar, run } from "../domain/values/smart-typography.js";

export { smartTypography } from "../domain/values/smart-typography.js";

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
