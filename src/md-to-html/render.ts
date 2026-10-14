// Render a Markdown source into a standalone HTML page.
//
// The body is wrapped in _layouts/default.html, which carries the fonts and
// styles. The layout leaves placeholders for the CSS shared with the web book
// ({{ code-css }}, {{ code-vars }}, {{ diagram-css }}) and for the book's own
// typefaces ({{ font-links }}, {{ font-text }}, {{ font-code }}), filled here
// from src/lib/content-css.ts and src/lib/fonts.ts so the two targets cannot
// drift. Heading ids are generated with the same slugifier the linter uses, so
// in-page `#anchor` links land on the ids the site renderers emit. The page
// title is taken from the first `#` heading.
//
// Shared by the web-book build and the md-to-html CLI.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import type { Token, Tokens, RendererThis } from "marked";
import { slugify } from "../lib/markdown.js";
import { substituteContentPlaceholders } from "../lib/content-placeholders.js";
import { CODE_LABELS } from "../lib/langs.js";
import { escapeHtml, brandHtml } from "../lib/html.js";
import { CONFIG } from "../lib/book-config.js";
import { tokenizeCode } from "../lib/code-tokens.js";
import { CODE_COMMENT_VAR, codeCss, diagramCss } from "../lib/content-css.js";
import { CODE_STACK, FONT_LINKS, TEXT_STACK } from "../lib/fonts.js";
import { preprocessMermaidMd, renderMermaid, substituteDiagrams } from "../diagrams/render.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const LAYOUT = path.join(ROOT, "_layouts", "default.html");

marked.use({
  renderer: {
    heading(this: RendererThis, { tokens, depth }: Tokens.Heading): string {
      const id = slugify(plainText(tokens));
      const inner = this.parser.parseInline(tokens);
      return `<h${depth} id="${id}">${inner}</h${depth}>`;
    },
    code(this: RendererThis, token: Tokens.Code): string {
      const lang = token.lang ?? "";
      const highlighted = token.escaped ? token.text : highlightComments(token.text, lang.toLowerCase());
      const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      const inner = `<pre><code${langAttr}>${highlighted}</code></pre>`;
      const label = CODE_LABELS[lang.toLowerCase()];
      return label ? `<div class="code-block"><span class="code-label">${label}</span>${inner}</div>` : inner;
    },
  },
});

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

/**
 * Wrap comment runs of a code block in `<span class="code-comment">`, leaving
 * the rest byte-for-byte as the plain escaped code block. The runs come from
 * {@link tokenizeCode}, which keeps strings out of them.
 */
function highlightComments(code: string, lang: string): string {
  let out = "";
  for (const { kind, text } of tokenizeCode(code, lang)) {
    const escaped = escapeHtml(text);
    out += kind === "comment" ? `<span class="code-comment">${escaped}</span>` : escaped;
  }
  return out;
}

function pageTitle(source: string): string {
  const match = /^#\s+(.+)$/m.exec(source);
  if (!match) return CONFIG.title;
  let title = match[1]
    .trim()
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_]{1,2}/g, "");
  title = title.replace(/\s+/g, " ").trim();
  return title ? `${title} — ${CONFIG.title}` : CONFIG.title;
}

/** The chapter body as HTML: headings carry slug ids, GFM is on. */
export function renderBody(source: string): string {
  return marked.parse(substituteContentPlaceholders(source), { gfm: true }) as string;
}

export function wrapInLayout(title: string, bodyHtml: string): string {
  // Replace with functions, not replacement strings: the CSS and the body HTML
  // can contain `$` sequences (PHP samples, say) that String.replace would
  // otherwise read as substitution patterns.
  return requireLayout()
    .replace("{{ title }}", () => title)
    .replace("{{ brand }}", () => brandHtml(CONFIG.title))
    .replace("{{ book-title }}", () => escapeHtml(CONFIG.title))
    .replace("{{ tagline }}", () => escapeHtml(CONFIG.tagline))
    .replace("{{ font-links }}", () => FONT_LINKS)
    .replace("{{ font-text }}", () => TEXT_STACK)
    .replace("{{ font-code }}", () => CODE_STACK)
    .replace("{{ code-vars }}", () => CODE_COMMENT_VAR)
    .replace("{{ code-css }}", () => codeCss())
    .replace("{{ diagram-css }}", () => diagramCss())
    .replace("{{ content }}", () => bodyHtml);
}

export function renderStandaloneHtml(source: string): string {
  return wrapInLayout(pageTitle(source), renderBody(source));
}

/**
 * Render a chapter body to HTML, converting ```mermaid``` fences into inline
 * SVG. Shared by the web-book build, the single-file PDF build, and the
 * per-page HTML previews, so a diagram looks identical in the site and the PDF.
 */
export async function renderSourceToHtml(source: string): Promise<string> {
  const { markdown, diagrams } = await preprocessMermaidMd(source);
  const placeholder = renderBody(markdown);
  const rendered = new Map<number, string>();
  for (const [index, diagramSource] of diagrams) {
    rendered.set(index, await renderMermaid(diagramSource, `diagram-${index}`));
  }
  return substituteDiagrams(placeholder, rendered);
}

/** {@link renderStandaloneHtml} with mermaid fences rendered to SVG. */
export async function renderStandaloneHtmlFromSource(source: string): Promise<string> {
  return wrapInLayout(pageTitle(source), await renderSourceToHtml(source));
}

let cachedLayout: string | null = null;

function requireLayout(): string {
  if (cachedLayout === null) {
    cachedLayout = fs.readFileSync(LAYOUT, "utf8");
  }
  return cachedLayout;
}
