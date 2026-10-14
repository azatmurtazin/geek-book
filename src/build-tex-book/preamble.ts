// The printed edition's preamble: the plain-LaTeX half of the printed edition.
//
// The LaTeX lives in preamble.tex beside this loader — plain TeX, highlighted
// as TeX and free of the escaping a TypeScript template literal demands
// (`\setmainfont`, `$`, a stray backtick). The few values that come from the
// book's config (the text, bold and code faces, and the running-head title) are
// `<< … >>` placeholders, filled in when the module loads.
//
// It sits apart from the serializer (tex.ts) because the walk does not write
// it — it is the same LaTeX on every build. The text block its geometry sets is
// the one tex.ts measures pictures against.

import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { CONFIG } from "../lib/book-config.js";
import { texEscape } from "./tex.js";

/** The config values preamble.tex names, each already escaped for LaTeX. */
const PLACEHOLDERS: Record<string, string> = {
  "text-font": texEscape(CONFIG.fonts.text),
  // Fontspec takes the bold face as an option, and only when the book names
  // one: empty leaves `\setmainfont{…}` bare.
  "text-font-options": CONFIG.fonts.bold ? `[BoldFont={${texEscape(CONFIG.fonts.bold)}}]` : "",
  "code-font": texEscape(CONFIG.fonts.code),
  "book-title": texEscape(CONFIG.title),
};

/** `<< key >>`, the placeholders preamble.tex carries. */
const PLACEHOLDER = /<<\s*([a-z][a-z0-9-]*)\s*>>/g;

/**
 * Everything the document needs before `\begin{document}`: A4 with the web
 * edition's margins, the text and code families the book names (bold text comes
 * from the face the book names for it — for the default Literata that is the
 * variable font's 700 instance, through harfbuzz), the callout and code-panel
 * environments, the heading shapes and spacing of the site's type scale, and
 * the running heads and footers the printed edition carries.
 *
 * Chapter and section numbers are off (`secnumdepth`), like the web edition,
 * but chapters still land in the table of contents. `plain` (chapter openers)
 * drops the running head but keeps the page number; front matter pages use
 * `empty`. `\pecnumberedplain` restores the chapter-opener style once the bare
 * front matter is past.
 */
export const PREAMBLE: string = fs
  .readFileSync(fileURLToPath(new URL("preamble.tex", import.meta.url)), "utf8")
  .replace(PLACEHOLDER, (whole, key: string) => PLACEHOLDERS[key] ?? whole)
  .trim();
