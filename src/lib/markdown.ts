// Generic markdown helpers shared by the renderers and the linter. They live in
// a neutral module so neither side depends on the other.
//
// `slugify` and `splitLines` are pure and now live in `domain/values/`; they are
// re-exported here for the callers that still name this path. `plainText` works
// over marked's tokens and so stays until the neutral tree arrives.

import { Marked } from "marked";
import type { Token, Tokens, RendererThis } from "marked";

import type { BookConfig } from "./book-config.js";
import { escapeHtml } from "./html.js";
import { codeLabel } from "./code-meta.js";
import { applySmartTypography } from "./smart-typography.js";
import { highlightComments } from "../md-to-html/render.js";
import { slugify } from "../domain/values/anchor.js";
import { splitLines } from "../domain/values/text.js";

export { slugify, splitLines };

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
  const marked = new Marked({
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
        const label = codeLabel(cfg.code, lang);
        return label ? `<div class="code-block"><span class="code-label">${escapeHtml(label)}</span>${inner}</div>` : inner;
      },
    }
  });
  if (cfg.markdown.smartTypography) {
    // Hooks run only on `parse`, which the website takes; the printed edition
    // lexes the same source and applies the same walk itself (see blocks.ts).
    marked.use({
      hooks: {
        processAllTokens(tokens): Token[] {
          applySmartTypography(tokens);
          return tokens;
        },
      },
    });
  }
  return marked;
}
