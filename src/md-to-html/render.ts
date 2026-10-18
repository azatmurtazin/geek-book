// Render a Markdown source into a standalone HTML page.
//
// The body is wrapped in _layouts/default.html, which carries the fonts and
// styles. The layout leaves a placeholder for the content CSS shared with the
// web book ({{ content-css }}, from src/lib/content.css) and for the book's own
// typefaces and palette ({{ font-links }}, {{ font-text }}, {{ font-code }},
// {{ palette }}), filled here from src/lib/fonts.ts and src/lib/web-palette.ts
// so the two targets cannot drift. Heading ids are
// generated with the same slugifier the linter uses, so in-page `#anchor` links
// land on the ids the site renderers emit. The page title is taken from the
// first `#` heading.
//
// Shared by the web-book build and the md-to-html CLI.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { markedInstance } from "../lib/markdown.js";
import { substituteContentPlaceholders } from "../lib/content-placeholders.js";
import { escapeHtml, brandHtml } from "../lib/html.js";
import type { BookConfig } from "../lib/book-config.js";
import { ui } from "../lib/ui-strings.js";
import { tokenizeCode } from "../lib/code-tokens.js";
import { readCss } from "../lib/css.js";
import { codeStack, fontLinks, textStack } from "../lib/fonts.js";
import { webPaletteVars } from "../lib/web-palette.js";
import { basePath, metaTags } from "../lib/site-meta.js";
import { extractDiagrams } from "../domain/services/extract-diagrams.js";
import { renderMermaid, substituteDiagrams } from "../diagrams/render.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const LAYOUT = path.join(ROOT, "_layouts", "default.html");

/**
 * Wrap comment runs of a code block in `<span class="code-comment">`, leaving
 * the rest byte-for-byte as the plain escaped code block. The runs come from
 * {@link tokenizeCode}, which keeps strings out of them.
 */
export function highlightComments(cfg: BookConfig, code: string, lang: string): string {
  let out = "";
  for (const { kind, text } of tokenizeCode(cfg.code, code, lang)) {
    const escaped = escapeHtml(text);
    out += kind === "comment" ? `<span class="code-comment">${escaped}</span>` : escaped;
  }
  return out;
}

function pageTitle(cfg: BookConfig, source: string): string {
  const match = /^#\s+(.+)$/m.exec(source);
  if (!match) return cfg.title;
  let title = match[1]
    .trim()
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_]{1,2}/g, "");
  title = title.replace(/\s+/g, " ").trim();
  return title ? `${title} — ${cfg.title}` : cfg.title;
}

/** The body for a source whose placeholders are already filled and whose
 *  mermaid fences are already placeholders. `breaks` is passed here, not to
 *  `markedInstance`, so it reaches the website's renderer and not the printed
 *  edition's lexer or the remote-image walker. */
export function renderPreparedBody(cfg: BookConfig, prepared: string): string {
  const md = markedInstance(cfg);
  return md.parse(prepared, { breaks: cfg.markdown.breaks }) as string;
}

/** The chapter body as HTML: headings carry slug ids, GFM is on. */
export function renderBody(cfg: BookConfig, source: string): string {
  return renderPreparedBody(cfg, substituteContentPlaceholders(cfg, source));
}

export function wrapInLayout(cfg: BookConfig, title: string, bodyHtml: string): string {
  // Replace with functions, not replacement strings: the CSS and the body HTML
  // can contain `$` sequences (PHP samples, say) that String.replace would
  // otherwise read as substitution patterns.
  return requireLayout()
    .replace("{{ title }}", () => escapeHtml(title))
    .replace("{{ meta }}", () => metaTags(cfg, { title, url: "" }))
    .replace("{{ lang }}", () => escapeHtml(cfg.language))
    .replace("{{ brand }}", () => brandHtml(cfg.title))
    .replace("{{ book-title }}", () => escapeHtml(cfg.title))
    .replace("{{ tagline }}", () => escapeHtml(cfg.tagline))
    .replaceAll("{{ base-path }}", () => escapeHtml(basePath(cfg)))
    .replace("{{ home }}", () => escapeHtml(ui(cfg, "home")))
    .replace("{{ font-links }}", () => fontLinks(cfg))
    .replace("{{ font-text }}", () => textStack(cfg))
    .replace("{{ font-code }}", () => codeStack(cfg))
    .replace("{{ palette }}", () => webPaletteVars(cfg))
    .replace("{{ content-css }}", () => readCss(import.meta.url, "../lib/content.css"))
    .replace("{{ content }}", () => bodyHtml);
}

export function renderStandaloneHtml(cfg: BookConfig, source: string): string {
  return wrapInLayout(cfg, pageTitle(cfg, source), renderBody(cfg, source));
}

/**
 * Render a chapter body to HTML, converting ```mermaid``` fences into inline
 * SVG. Shared by the web-book build, the single-file PDF build, and the
 * per-page HTML previews, so a diagram looks identical in the site and the PDF.
 */
export async function renderSourceToHtml(cfg: BookConfig, source: string): Promise<string> {
  const { markdown, diagrams } = extractDiagrams(source);
  const placeholder = renderBody(cfg, markdown);
  const rendered = new Map<number, string>();
  for (const [index, diagramSource] of diagrams) {
    rendered.set(index, await renderMermaid(cfg, diagramSource, `diagram-${index}`));
  }
  return substituteDiagrams(placeholder, rendered);
}

/** {@link renderStandaloneHtml} with mermaid fences rendered to SVG. */
export async function renderStandaloneHtmlFromSource(cfg: BookConfig, source: string): Promise<string> {
  return wrapInLayout(cfg, pageTitle(cfg, source), await renderSourceToHtml(cfg, source));
}

let cachedLayout: string | null = null;

function requireLayout(): string {
  if (cachedLayout === null) {
    cachedLayout = fs.readFileSync(LAYOUT, "utf8");
  }
  return cachedLayout;
}
