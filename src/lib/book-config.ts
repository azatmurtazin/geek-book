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

function load(): BookConfig {
  const root = process.cwd();
  const raw = readJson(path.join(root, "book.config.json")) ?? {};
  const fonts = (raw.fonts ?? {}) as Record<string, unknown>;
  const output = (raw.output ?? {}) as Record<string, unknown>;
  const packageJson = readJson(path.join(root, "package.json")) ?? {};

  const bookDir = path.resolve(root, asString(raw.bookDir, DEFAULTS.bookDir));
  const cover = asString(raw.cover, "");
  const text = asString(fonts.text, DEFAULTS.fonts.text);
  const code = asString(fonts.code, DEFAULTS.fonts.code);
  const builtIn = text === DEFAULTS.fonts.text && code === DEFAULTS.fonts.code;

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
  };
}

/** The book being built, resolved once per process from the working directory. */
export const CONFIG: BookConfig = load();
