// The website's palette, taken from the printed edition's so the two editions
// cannot drift: the site stylesheet and the standalone page layout both read
// these custom properties, and both get them from here. Only the colours the
// printed edition already has are derived; the site-only ones — the accents,
// the page and sidebar backgrounds, the zebra stripe — stay in their
// stylesheets, and the reader's night palette is the engine's own, in site.css.

import { CONFIG, type ColorKey } from "./book-config.js";

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
export const WEB_PALETTE_VARS = [
  ":root {",
  ...WEB_VARS.map(([key, name]) => `  ${name}: ${CONFIG.tex.colors[key]};`),
  "}",
].join("\n");
