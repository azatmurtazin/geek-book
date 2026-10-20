// Render a Markdown source into a standalone HTML page.
//
// The body is rendered from the same document tree the printed edition uses
// (`domain/services/assemble.ts` → `adapters/render-html`), so heading ids come
// from the same slugifier the linter checks and a page needs no second HTML
// pipeline. The tree is wrapped in _layouts/default.html, which carries the
// fonts and styles. The layout leaves a placeholder for the content CSS shared
// with the web book ({{ content-css }}, from
// `adapters/render-html/content.css`) and for the book's own typefaces and
// palette ({{ font-links }}, {{ font-text }}, {{ font-code }}, {{ palette }}),
// filled here from `adapters/render-html/stylesheets.ts` so the two targets
// cannot drift. The page title is taken from the first `#` heading.
//
// Shared by the web-book build and the md-to-html CLI.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { substituteContentPlaceholders } from "../lib/content-placeholders.js";
import { escapeHtml, brandHtml } from "../adapters/render-html/escape.js";
import type { BookConfig } from "../lib/book-config.js";
import { ui } from "../lib/ui-strings.js";
import { readCss } from "../adapters/render-html/css.js";
import { codeStack, fontLinks, textStack, webPaletteVars } from "../adapters/render-html/stylesheets.js";
import { basePath, metaTags } from "../adapters/render-html/site-meta.js";
import { MarkedParser } from "../adapters/markdown/marked-parser.js";
import { MermaidRenderer } from "../adapters/diagrams/mermaid-renderer.js";
import { NoRemoteImages } from "../adapters/http/remote-images.js";
import { renderChapterBody, type HtmlContext } from "../adapters/render-html/html-renderer.js";
import { sourceToModel, type SourceDeps } from "../application/pipelines/source-to-model.js";
import { assemble } from "../domain/services/assemble.js";
import { applySmartTypography } from "../domain/values/smart-typography.js";
import type { ChapterContext } from "../domain/model/chapter.js";

export { highlightComments } from "../adapters/render-html/html-renderer.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const LAYOUT = path.join(ROOT, "_layouts", "default.html");

/** A standalone page: no chapter number, no sibling pages, bare slugs. */
const STANDALONE: ChapterContext = { chapterId: 0, relBook: "", idOf: new Map() };

/** A context for a page that links to nothing: hrefs and srcs stay as written. */
function standaloneContext(cfg: BookConfig): HtmlContext {
  return { code: cfg.code, href: (href) => href, src: (src) => src };
}

/** The ports a standalone render draws through: drawn fences, no remote cache. */
function standaloneDeps(cfg: BookConfig): SourceDeps {
  return {
    markdown: new MarkedParser(cfg.markdown.breaks),
    diagrams: new MermaidRenderer(cfg),
    images: new NoRemoteImages(),
    substitute: (source) => substituteContentPlaceholders(cfg, source),
    smartTypography: cfg.markdown.smartTypography,
    bookDir: cfg.bookDir,
    diagramName: (index) => ({ id: `diagram-${index}`, name: `diagram-${index}` }),
  };
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

/** The chapter body as HTML: headings carry slug ids, GFM is on. */
export function renderBody(cfg: BookConfig, source: string): string {
  const nodes = new MarkedParser(cfg.markdown.breaks).lex(substituteContentPlaceholders(cfg, source));
  if (cfg.markdown.smartTypography) {
    applySmartTypography(nodes);
  }
  const chapter = assemble(nodes, STANDALONE, { bookDir: cfg.bookDir });
  return renderChapterBody(chapter, standaloneContext(cfg));
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
    .replace("{{ content-css }}", () => readCss(import.meta.url, "../adapters/render-html/content.css"))
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
  const result = await sourceToModel(source, STANDALONE, standaloneDeps(cfg));
  if (!result.ok) throw new Error(result.diagnostics[0].message);
  return renderChapterBody(result.value, standaloneContext(cfg));
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
