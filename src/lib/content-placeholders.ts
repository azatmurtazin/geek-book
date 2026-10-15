// Build-time placeholders available inside chapter Markdown, so one source
// reads correctly in both the website and the printed book.
//
// The layout carries its own placeholders ({{ title }}, {{ content-css }}, …),
// filled in the HTML wrapper; these fill the content itself, before `marked`
// parses it. The built-in tokens are the book's metadata — version, title,
// author and tagline — and a book adds its own through the config's
// `placeholders` map. Fenced code blocks are left byte-for-byte, so a
// `{{ … }}` inside a sample (Go templates, JSX, C++ braces) is never rewritten,
// and only the known keys are replaced — anything else, such as Go's `{{.}}`,
// passes through.

import { CONFIG } from "./book-config.js";

const PLACEHOLDERS: Record<string, string> = {
  // A book's own tokens first, so the built-in keys below win on a clash.
  ...CONFIG.placeholders,
  version: CONFIG.version,
  title: CONFIG.title,
  author: CONFIG.author,
  tagline: CONFIG.tagline,
};

const PLACEHOLDER = /\{\{\s*([a-z][a-z0-9-]*)\s*\}\}/g;
const FENCE = /^\s{0,3}(?:```|~~~)/;

/**
 * Fill the content placeholders in a chapter's Markdown. Both renderers call
 * this before parsing, so the site and the book substitute identically.
 */
export function substituteContentPlaceholders(source: string): string {
  let inFence = false;
  return source
    .split("\n")
    .map((line) => {
      if (FENCE.test(line)) {
        inFence = !inFence;
        return line;
      }
      return inFence ? line : line.replace(PLACEHOLDER, (whole, key: string) => PLACEHOLDERS[key] ?? whole);
    })
    .join("\n");
}
