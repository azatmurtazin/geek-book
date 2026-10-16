// The typefaces both editions are set in, resolved from the book's config.
//
// A book names families, not files. The website and the standalone previews
// load them from the webfont stylesheet in `fonts.web`, with a system fallback
// behind the family in case the stylesheet is absent or the reader is offline;
// the printed edition asks LuaLaTeX for the family by name instead, so the
// fonts have to be installed where the build runs. The diagrams follow the text
// family because the Mermaid SVG is drawn back through fontconfig
// (rsvg-convert), so they too need the family installed.

import type { BookConfig } from "./book-config.js";
import { escapeHtml } from "./html.js";

/** CSS stack for the prose, headings and navigation. */
export function textStack(cfg: BookConfig) {
  return `"${cfg.fonts.text}", "Iowan Old Style", Georgia, "Times New Roman", serif`;
}

/** CSS stack for code, inline and block alike. */
export function codeStack(cfg: BookConfig) {
  return `"${cfg.fonts.code}", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
}

/** `font-family` for diagrams: the text family, then a face the image has. */
export function diagramFamily(cfg: BookConfig) {
  return `${cfg.fonts.text}, 'DejaVu Serif', serif`;
}

/**
 * The webfont `<link>` tags, or "" when the book loads no stylesheet. The
 * preconnects suit a Google Fonts stylesheet and are harmless in front of any
 * other.
 */
export function fontLinks(cfg: BookConfig) {
  return cfg.fonts.web
    ? `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${escapeHtml(cfg.fonts.web)}" rel="stylesheet">`
    : "";
}

/**
 * The families as custom properties: the `:root` block the web book's
 * stylesheet opens with, since the values come from the book's config and so
 * cannot live in the .css file itself.
 */
export function fontCssVars(cfg: BookConfig) {
  return `:root {
  --font-sans: ${textStack(cfg)};
  --font-mono: ${codeStack(cfg)};
}`;
}
