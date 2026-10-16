// Generic markdown helpers shared by the renderers and the linter. They live in
// a neutral module so neither side depends on the other.

import { Marked } from "marked";
import type { Token, Tokens, RendererThis } from "marked";

import type { BookConfig } from "./book-config.js";
import { escapeHtml } from "./html.js";
import { codeLabel } from "./code-meta.js";
import { highlightComments } from "../md-to-html/render.js";

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

export function markedInstance(cfg: BookConfig): Marked {
  return new Marked({
    gfm: true,
    renderer: {
      heading(this: RendererThis, { tokens, depth }: Tokens.Heading): string {
        const id = slugify(plainText(tokens));
        const inner = this.parser.parseInline(tokens);
        return `<h${depth} id="${id}">${inner}</h${depth}>`;
      },
      code(this: RendererThis, token: Tokens.Code): string {
        const lang = token.lang ?? "";
        const highlighted = token.escaped ? token.text : highlightComments(cfg, token.text, lang.toLowerCase());
        const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : "";
        const inner = `<pre><code${langAttr}>${highlighted}</code></pre>`;
        const label = codeLabel(cfg, lang);
        return label ? `<div class="code-block"><span class="code-label">${escapeHtml(label)}</span>${inner}</div>` : inner;
      },
    }
  });
}
