// Generic markdown helpers shared by the renderers and the linter. They live in
// a neutral module so neither side depends on the other.

import type { Token } from "marked";

/** Split on newlines the way Python's `splitlines()` did (no trailing empty). */
export function splitLines(text: string): string[] {
  const lines = text.split(/\r?\n/);
  if (lines.length && text.endsWith("\n") && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

/** Approximate the header identifier algorithm the renderers emit, close enough to check. */
export function slugify(text: string): string {
  const withoutMarkup = text
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, "$1");
  const stripped = withoutMarkup.toLowerCase().replace(/[^\p{L}\p{N}_\- ]+/gu, "");
  return stripped.replace(/ /g, "-");
}

/** Concatenated text of inline tokens — heading labels and slugs. */
export function plainText(tokens: Token[]): string {
  let out = "";
  for (const token of tokens) {
    const anyToken = token as { text?: string; tokens?: Token[] };
    if (anyToken.tokens && anyToken.tokens.length) out += plainText(anyToken.tokens);
    else if (anyToken.text) out += anyToken.text;
  }
  return out;
}
