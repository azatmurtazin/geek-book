// The website's stylesheet inputs: the typefaces and the palette both web
// targets are set in, resolved from the book's config.
//
// The font and palette values come from the book, so they cannot live in a .css
// file: `fontCssVars` and `webPaletteVars` build the `:root` blocks the web
// book's stylesheet opens with and the standalone layout pastes in, so the two
// editions cannot drift. `fontLinks` is the webfont `<link>` tags, and
// `diagramFamily` is the family the rendered SVG is drawn back through
// (rsvg-convert reads it via fontconfig), so a diagram matches the text.
//
// Fonts: a book names families, not files. The website and the standalone
// previews load them from the webfont stylesheet in `fonts.web`, with a system
// fallback behind the family in case the stylesheet is absent or the reader is
// offline; the printed edition asks LuaLaTeX for the family by name instead, so
// the fonts have to be installed where the build runs.
//
// Palette: only the colours the printed edition already has are derived; the
// site-only ones — the accents, the page and sidebar backgrounds, the zebra
// stripe — stay in the stylesheets, and the reader's night palette is the
// engine's own, in `adapters/web/site.css`.

import type { BookConfig, ColorKey } from "../../lib/book-config.js";
import { escapeHtml } from "./escape.js";

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

/** The web custom property each configured colour feeds. */
const WEB_VARS: ReadonlyArray<[ColorKey, string]> = [
  ["fg", "--fg"],
  ["muted", "--muted"],
  ["rule", "--rule"],
  ["codeBackground", "--code-bg"],
  ["codeForeground", "--code-fg"],
  ["codeComment", "--code-comment"],
  ["calloutBackground", "--callout-bg"],
  ["calloutBorder", "--callout-border"],
  ["calloutForeground", "--quote-fg"],
];

/**
 * The palette as a `:root` block, for both web targets. Each value is the
 * printed edition's, so a book that names `tex.colors` repaints the website
 * too; the site-only properties around it stay in the stylesheets.
 */
export function webPaletteVars(cfg: BookConfig) {
  return [
    ":root {",
    ...WEB_VARS.map(([key, name]) => `  ${name}: ${cfg.tex.colors[key]};`),
    "}",
  ].join("\n");
}
