// Where the engine learns *which* book it is building.
//
// A book repo keeps a `book.config.json` at its root and is built by running
// `geek-book` from that root, so the working directory is the book. Everything
// the engine would otherwise have to hard-code about one particular book — the
// title, the tagline, where the sources live, where the editions go — comes
// from there, with defaults that fit the conventional layout. The version is
// read from the book's own package.json unless the config names one, so the
// number still lives in exactly one place.

import fs from "node:fs";
import path from "node:path";
import { DEFAULT_LANGS } from "./langs.js";

/**
 * The typefaces the book is set in. A book names families, never files: the
 * website loads the families from the webfont stylesheet, and the printed
 * edition asks the system (fontconfig, via LuaLaTeX) for a family by name, so
 * the fonts have to be installed where the build runs. The engine's Docker
 * image carries the defaults.
 */
export interface FontsConfig {
  /** Family the body text, the headings and the diagrams are set in. */
  text: string;
  /**
   * The text font's bold face, as a fontspec declaration (`Family:options`).
   * Only needed when bold is a weight instance of a variable font rather than a
   * face of its own, since fontconfig then reports no bold for the family —
   * which is the case for the default, Literata. Empty leaves the family's own
   * bold, which is what a book that names its own family starts out with.
   */
  bold: string;
  /** Family code blocks are set in. */
  code: string;
  /**
   * Webfont stylesheet the website and previews load. Empty loads none. The
   * default is the engine's own stylesheet while the families are the engine's;
   * a book with families of its own starts with no webfont.
   */
  web: string;
}

/** The papers a book may set, with their dimensions in millimetres. */
export const PAPERS = {
  a4: { option: "a4paper", widthMm: 210, heightMm: 297 },
  a5: { option: "a5paper", widthMm: 148, heightMm: 210 },
  letter: { option: "letterpaper", widthMm: 215.9, heightMm: 279.4 },
  legal: { option: "legalpaper", widthMm: 215.9, heightMm: 355.6 },
} as const;

export type PaperName = keyof typeof PAPERS;

/**
 * The printed edition's page: a paper and its margins, all in millimetres. The
 * text block the PDF builder measures pictures against is derived from these,
 * so a book that changes its margins does not have to say anything else.
 */
export interface GeometryConfig {
  /** Paper name: `a4`, `a5`, `letter` or `legal`. */
  paper: PaperName;
  /** Margins in millimetres. */
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** Text block width: the paper width less the side margins. */
  textWidthMm: number;
  /** Text block height: the paper height less the top and bottom margins. */
  textHeightMm: number;
}

/** The printed edition's palette, each value `#rrggbb`. */
export type ColorKey =
  | "fg"
  | "muted"
  | "rule"
  | "codeBackground"
  | "codeForeground"
  | "codeComment"
  | "calloutBackground"
  | "calloutBorder"
  | "calloutForeground";

export type ColorsConfig = Record<ColorKey, string>;

/**
 * The printed edition's type scale, in points. Heading leading is 1.2× the
 * size, rounded up to a whole point; `base` is the document class size, one of
 * 10, 11 or 12.
 */
export interface TypeConfig {
  base: number;
  chapter: number;
  section: number;
  subsection: number;
  subsubsection: number;
  paragraph: number;
}

/**
 * What a book may change about the printed edition: its page, its palette and
 * its type scale, plus a file of extra LaTeX for anything else. None of it
 * touches the website, whose look lives in CSS.
 */
export interface TexConfig {
  geometry: GeometryConfig;
  colors: ColorsConfig;
  type: TypeConfig;
  /** Absolute path of extra LaTeX appended after the built-in preamble, or "". */
  preamble: string;
}

export interface BookConfig {
  /** The book root: the directory the CLI runs from. */
  root: string;
  title: string;
  tagline: string;
  author: string;
  version: string;
  /** Absolute path of the Markdown sources (default `<root>/book`). */
  bookDir: string;
  summary: string;
  chapters: string;
  readme: string;
  /** Cover image for the PDF (default `<bookDir>/cover.jpg`; may be absent). */
  cover: string;
  /** Absolute output paths. */
  outputWeb: string;
  outputPdf: string;
  /** Extra Markdown at the root whose links the linter also checks. */
  docs: string[];
  /** Fence languages the linter accepts. */
  languages: Set<string>;
  /** The typefaces both editions are set in. */
  fonts: FontsConfig;
  /** The printed edition's page, palette and type scale. */
  tex: TexConfig;
}

const DEFAULTS = {
  bookDir: "book",
  web: "build/html",
  pdf: "build/book.pdf",
  docs: ["README.md", "CONTRIBUTING.md"],
  fonts: {
    text: "Literata",
    bold: "Literata:mode=harf;wght=700",
    code: "JetBrains Mono",
    web: "https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400..700;1,7..72,400..700&family=JetBrains+Mono:wght@400;500&display=swap",
  },
  tex: {
    geometry: { paper: "a4" as PaperName, top: 19, bottom: 19, left: 18, right: 18 },
    colors: {
      fg: "#242a37",
      muted: "#667085",
      rule: "#e4e7ec",
      codeBackground: "#f6f7f9",
      codeForeground: "#20304c",
      codeComment: "#6b7280",
      calloutBackground: "#f8fafc",
      calloutBorder: "#cbd5e1",
      calloutForeground: "#3b4252",
    } satisfies ColorsConfig,
    type: {
      base: 11,
      chapter: 20,
      section: 15,
      subsection: 12.5,
      subsubsection: 11.5,
      paragraph: 9.5,
    } satisfies TypeConfig,
  },
};

function readJson(file: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
}

/** Like `asString`, but an explicit empty string counts as a value: it turns
 * the setting off (no webfonts, no bold face of its own). */
function asOptionalString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function asStringList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const list = value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
  return list.length ? list : null;
}

/** A length in millimetres: a non-negative finite number, else the default. */
function asMillimetres(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** A point size: a positive finite number, else the default. */
function asPoints(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

/** The document class size: LaTeX takes 10, 11 or 12. */
function asBaseSize(value: unknown, fallback: number): number {
  return value === 10 || value === 11 || value === 12 ? value : fallback;
}

/** Round to hundredths, so derived lengths read cleanly in the config dump. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** A `#rrggbb` colour, normalized to lower case, else the default. */
function asColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const hex = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : fallback;
}

function asPaper(value: unknown, fallback: PaperName): PaperName {
  return typeof value === "string" && value in PAPERS ? (value as PaperName) : fallback;
}

function readColors(raw: Record<string, unknown>): ColorsConfig {
  return {
    fg: asColor(raw.fg, DEFAULTS.tex.colors.fg),
    muted: asColor(raw.muted, DEFAULTS.tex.colors.muted),
    rule: asColor(raw.rule, DEFAULTS.tex.colors.rule),
    codeBackground: asColor(raw.codeBackground, DEFAULTS.tex.colors.codeBackground),
    codeForeground: asColor(raw.codeForeground, DEFAULTS.tex.colors.codeForeground),
    codeComment: asColor(raw.codeComment, DEFAULTS.tex.colors.codeComment),
    calloutBackground: asColor(raw.calloutBackground, DEFAULTS.tex.colors.calloutBackground),
    calloutBorder: asColor(raw.calloutBorder, DEFAULTS.tex.colors.calloutBorder),
    calloutForeground: asColor(raw.calloutForeground, DEFAULTS.tex.colors.calloutForeground),
  };
}

function readType(raw: Record<string, unknown>): TypeConfig {
  return {
    base: asBaseSize(raw.base, DEFAULTS.tex.type.base),
    chapter: asPoints(raw.chapter, DEFAULTS.tex.type.chapter),
    section: asPoints(raw.section, DEFAULTS.tex.type.section),
    subsection: asPoints(raw.subsection, DEFAULTS.tex.type.subsection),
    subsubsection: asPoints(raw.subsubsection, DEFAULTS.tex.type.subsubsection),
    paragraph: asPoints(raw.paragraph, DEFAULTS.tex.type.paragraph),
  };
}

function load(): BookConfig {
  const root = process.cwd();
  const raw = readJson(path.join(root, "book.config.json")) ?? {};
  const fonts = (raw.fonts ?? {}) as Record<string, unknown>;
  const output = (raw.output ?? {}) as Record<string, unknown>;
  const tex = (raw.tex ?? {}) as Record<string, unknown>;
  const geometryRaw = (tex.geometry ?? {}) as Record<string, unknown>;
  const packageJson = readJson(path.join(root, "package.json")) ?? {};

  const bookDir = path.resolve(root, asString(raw.bookDir, DEFAULTS.bookDir));
  const cover = asString(raw.cover, "");
  const text = asString(fonts.text, DEFAULTS.fonts.text);
  const code = asString(fonts.code, DEFAULTS.fonts.code);
  const builtIn = text === DEFAULTS.fonts.text && code === DEFAULTS.fonts.code;

  const paper = asPaper(geometryRaw.paper, DEFAULTS.tex.geometry.paper);
  const top = asMillimetres(geometryRaw.top, DEFAULTS.tex.geometry.top);
  const bottom = asMillimetres(geometryRaw.bottom, DEFAULTS.tex.geometry.bottom);
  const left = asMillimetres(geometryRaw.left, DEFAULTS.tex.geometry.left);
  const right = asMillimetres(geometryRaw.right, DEFAULTS.tex.geometry.right);
  const paperSize = PAPERS[paper];
  const extraPreamble = asString(tex.preamble, "");

  return {
    root,
    title: asString(raw.title, asString(packageJson.name, "Untitled book")),
    tagline: asString(raw.tagline, ""),
    author: asString(raw.author, ""),
    version: asString(raw.version, asString(packageJson.version, "0.0.0")),
    bookDir,
    summary: path.join(bookDir, "SUMMARY.md"),
    chapters: path.join(bookDir, "chapters"),
    readme: path.join(bookDir, "README.md"),
    cover: cover ? path.resolve(root, cover) : path.join(bookDir, "cover.jpg"),
    outputWeb: path.resolve(root, asString(output.web, DEFAULTS.web)),
    outputPdf: path.resolve(root, asString(output.pdf, DEFAULTS.pdf)),
    docs: (asStringList(raw.docs) ?? [...DEFAULTS.docs]).map((doc) => path.resolve(root, doc)),
    languages: new Set(asStringList(raw.languages) ?? DEFAULT_LANGS),
    fonts: {
      text,
      // The default bold face belongs to the default family: a book that names
      // another family gets that family's own bold, not Literata's instance of
      // it, unless it spells the bold face out.
      bold: asOptionalString(fonts.bold, text === DEFAULTS.fonts.text ? DEFAULTS.fonts.bold : ""),
      code,
      // The built-in stylesheet asks for the built-in families, so it stays with
      // them: a book that names its own families starts with no webfont and can
      // name one (or say "" for none) under `web`.
      web: asOptionalString(fonts.web, builtIn ? DEFAULTS.fonts.web : ""),
    },
    tex: {
      geometry: {
        paper,
        top,
        bottom,
        left,
        right,
        // A margin wider than the paper clamps to a hairline rather than a
        // non-positive block, which would break the picture scaling.
        textWidthMm: round2(Math.max(1, paperSize.widthMm - left - right)),
        textHeightMm: round2(Math.max(1, paperSize.heightMm - top - bottom)),
      },
      colors: readColors((tex.colors ?? {}) as Record<string, unknown>),
      type: readType((tex.type ?? {}) as Record<string, unknown>),
      preamble: extraPreamble ? path.resolve(root, extraPreamble) : "",
    },
  };
}

/** The book being built, resolved once per process from the working directory. */
export const CONFIG: BookConfig = load();
