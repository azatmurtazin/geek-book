// The printed edition's preamble: the plain-LaTeX half of the printed edition.
//
// The LaTeX lives in preamble.tex beside this loader — plain TeX, highlighted
// as TeX and free of the escaping a TypeScript template literal demands
// (`\setmainfont`, `$`, a stray backtick). The values that come from the book's
// config — the fonts, the title, and the `tex` block's page, palette and type
// scale — are `<< … >>` placeholders, filled in when the module loads. A book
// that wants more writes its own LaTeX and names it under `tex.preamble`; it is
// appended after the built-in preamble, so it can redefine anything above.
//
// It sits apart from the serializer (tex.ts) because the walk does not write
// it — it is the same LaTeX on every build. The text block its geometry sets is
// the one tex.ts measures pictures against.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CONFIG, PAPERS, type ColorKey } from "../lib/book-config.js";
import { UI_DEFAULTS } from "../lib/ui-strings.js";
import { texEscape } from "./tex.js";

/** The Tex name of each configured colour, and the order they are defined in. */
const COLORS: ReadonlyArray<[ColorKey, string]> = [
  ["fg", "fg"],
  ["muted", "muted"],
  ["rule", "rule"],
  ["codeBackground", "codebg"],
  ["codeForeground", "codefg"],
  ["codeComment", "codecomment"],
  ["calloutBackground", "calloutbg"],
  ["calloutBorder", "calloutborder"],
  ["calloutForeground", "calloutfg"],
];

/**
 * The colours `\incode` uses, which a paragraph heading's `\MakeUppercase`
 * rewrites — colour names inside its argument are uppercased, so each needs an
 * alias in capitals.
 */
const UPPERCASE = ["rule", "codebg", "codefg"];

/** The colour block: the configured palette, then the aliases above. */
function colorsTex(): string {
  const hex = new Map(COLORS.map(([key, tex]) => [tex, CONFIG.tex.colors[key].replace(/^#/, "")]));
  const lines = COLORS.map(([, tex]) => `\\definecolor{${tex}}{HTML}{${hex.get(tex)}}`);
  lines.push(
    "% \\MakeUppercase (table headers, headings) uppercases character tokens",
    "% inside \\incode's arguments, including color names — give it aliases.",
  );
  for (const tex of UPPERCASE) lines.push(`\\definecolor{${tex.toUpperCase()}}{HTML}{${hex.get(tex)}}`);
  return lines.join("\n");
}

/** Heading leading: 1.2× the size, rounded up to a whole point. */
function leading(size: number): number {
  // Take the size in tenths of a point first: `size * 1.2` can land a hair over
  // 24 for a 20pt heading, and the ceil would then add a point.
  return Math.ceil((Math.round(size * 10) * 3) / 25);
}

/** babel's name for each primary language subtag the engine recognizes. */
const BABEL_LANGUAGES: Record<string, string> = {
  de: "ngerman",
  fr: "french",
  es: "spanish",
  pt: "portuguese",
  it: "italian",
  nl: "dutch",
  pl: "polish",
  cs: "czech",
  sk: "slovak",
  hu: "magyar",
  ro: "romanian",
  da: "danish",
  sv: "swedish",
  nb: "norsk",
  nn: "norsk",
  no: "norsk",
  fi: "finnish",
  tr: "turkish",
  el: "greek",
  ru: "russian",
  uk: "ukrainian",
  bg: "bulgarian",
  sr: "serbian",
  ca: "catalan",
  gl: "galician",
  eu: "basque",
  is: "icelandic",
  sl: "slovene",
  hr: "croatian",
  et: "estonian",
};

/**
 * The `\usepackage[…]{babel}` line for the book's language, or `""` for English
 * and for anything the engine does not recognize. English is LaTeX's own
 * default, so a book that names no language loads no babel and hyphenates as it
 * always did; a book that names another language has to have that language's
 * babel files installed (the Docker image carries the common ones).
 */
function babelPreamble(language: string): string {
  const option = BABEL_LANGUAGES[language.trim().toLowerCase().split("-")[0]];
  return option ? `\\usepackage[${option}]{babel}` : "";
}

/**
 * The line that names the table of contents, or `""` to leave it to babel.
 *
 * Babel sets a language's caption at `\begin{document}`, so a plain
 * `\renewcommand` in the preamble is overwritten; the override is applied there
 * too, after babel's, to win. A book that names no `strings.contents` keeps the
 * language pack's caption — except in English, which loads no babel and whose
 * LaTeX default is "Contents", where the engine supplies its own name.
 */
function contentsLine(babel: string): string {
  const override = CONFIG.strings.contents;
  if (override === undefined && babel !== "") return "";
  const name = override ?? UI_DEFAULTS.contents;
  return `\\AtBeginDocument{\\renewcommand{\\contentsname}{${texEscape(name)}}}`;
}

/** Every value preamble.tex names, from the book's config. */
function placeholders(): Record<string, string> {
  const { geometry, type } = CONFIG.tex;
  const babel = babelPreamble(CONFIG.language);
  return {
    babel,
    contents: contentsLine(babel),
    "text-font": texEscape(CONFIG.fonts.text),
    // Fontspec takes the bold face as an option, and only when the book names
    // one: empty leaves `\setmainfont{…}` bare.
    "text-font-options": CONFIG.fonts.bold ? `[BoldFont={${texEscape(CONFIG.fonts.bold)}}]` : "",
    "code-font": texEscape(CONFIG.fonts.code),
    "book-title": texEscape(CONFIG.title),
    "base-size": `${type.base}pt`,
    paper: PAPERS[geometry.paper].option,
    side: CONFIG.tex.side,
    "doc-class": CONFIG.tex.class,
    geometry: `top=${geometry.top}mm,bottom=${geometry.bottom}mm,left=${geometry.left}mm,right=${geometry.right}mm`,
    colors: colorsTex(),
    "toc-depth": String(CONFIG.tex.tocDepth),
    "chapter-size": `${type.chapter}`,
    "chapter-leading": `${leading(type.chapter)}`,
    "section-size": `${type.section}`,
    "section-leading": `${leading(type.section)}`,
    "subsection-size": `${type.subsection}`,
    "subsection-leading": `${leading(type.subsection)}`,
    "subsubsection-size": `${type.subsubsection}`,
    "subsubsection-leading": `${leading(type.subsubsection)}`,
    "paragraph-size": `${type.paragraph}`,
    "paragraph-leading": `${leading(type.paragraph)}`,
  };
}

/** `<< key >>`, the placeholders preamble.tex carries. */
const PLACEHOLDER = /<<\s*([a-z][a-z0-9-]*)\s*>>/g;

/**
 * Everything the document needs before `\begin{document}`: the configured paper
 * and margins, the text and code families the book names, the callout and
 * code-panel environments, the heading shapes and spacing of the site's type
 * scale, and the running heads and footers the printed edition carries.
 *
 * Chapter and section numbers are off (`secnumdepth`), like the web edition,
 * but chapters still land in the table of contents. `plain` (chapter openers)
 * drops the running head but keeps the page number; front matter pages use
 * `empty`. `\pecnumberedplain` restores the chapter-opener style once the bare
 * front matter is past.
 *
 * A book's `tex.preamble` file, when named, is appended after all of it.
 */
export function preambleTex(): string {
  const values = placeholders();
  const base = readPreamble()
    .replace(PLACEHOLDER, (whole, key: string) => values[key] ?? whole)
    .trim();
  const extra = CONFIG.tex.preamble ? readLatex(CONFIG.tex.preamble) : "";
  return extra ? `${base}\n\n${extra}` : base;
}

/** The LaTeX of the built-in preamble, before its placeholders are filled. */
function readPreamble(): string {
  return fs.readFileSync(fileURLToPath(new URL("preamble.tex", import.meta.url)), "utf8");
}

/** Extra LaTeX a book supplies, with a message that names the file if missing. */
function readLatex(file: string): string {
  if (!fs.existsSync(file)) {
    throw new Error(`the tex.preamble file is missing: ${path.relative(CONFIG.root, file)}`);
  }
  return fs.readFileSync(file, "utf8").trim();
}
