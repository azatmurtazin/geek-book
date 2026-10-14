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
}

const DEFAULTS = {
  bookDir: "book",
  web: "build/html",
  pdf: "build/book.pdf",
  docs: ["README.md", "CONTRIBUTING.md"],
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

function asStringList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const list = value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
  return list.length ? list : null;
}

function load(): BookConfig {
  const root = process.cwd();
  const raw = readJson(path.join(root, "book.config.json")) ?? {};
  const output = (raw.output ?? {}) as Record<string, unknown>;
  const packageJson = readJson(path.join(root, "package.json")) ?? {};

  const bookDir = path.resolve(root, asString(raw.bookDir, DEFAULTS.bookDir));
  const cover = asString(raw.cover, "");

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
  };
}

/** The book being built, resolved once per process from the working directory. */
export const CONFIG: BookConfig = load();
