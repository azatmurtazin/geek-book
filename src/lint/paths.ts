import fs from "node:fs";
import path from "node:path";
import { CONFIG } from "../lib/book-config.js";

// Where the book lives. Resolved by `CONFIG` from the working directory (the
// book root) and its book.config.json, so the builders, the linter and the
// server all agree no matter where the engine itself is installed.

export const ROOT = CONFIG.root;
export const BOOK = CONFIG.bookDir;
export const SUMMARY = CONFIG.summary;
export const CHAPTERS = CONFIG.chapters;
export const README = CONFIG.readme;
export const COVER = CONFIG.cover;

/** All `.md` files under `dir`, as absolute paths; none when `dir` is absent. */
export function markdownFilesUnder(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) {
    return out;
  }
  (function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".md")) {
        out.push(full);
      }
    }
  })(dir);
  return out;
}

/** True when `dir` (recursively) contains at least one `.md` file. */
export function hasMarkdown(dir: string): boolean {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (hasMarkdown(path.join(dir, entry.name))) {
        return true;
      }
    } else if (entry.name.endsWith(".md")) {
      return true;
    }
  }
  return false;
}
