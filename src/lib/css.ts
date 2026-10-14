// The engine's stylesheets are plain .css files, read when a build runs. They
// are not compiled: a book build has no CSS step, so what an editor highlights
// and what a browser is handed are the same bytes. Keeping them out of
// TypeScript template literals also keeps CSS punctuation — a backtick in a
// comment, say — from breaking the build.

import fs from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Read a stylesheet that ships with the engine, named relative to the module
 * that asks for it: `readCss(import.meta.url, "site.css")`.
 */
export function readCss(importer: string, name: string): string {
  return fs.readFileSync(fileURLToPath(new URL(name, importer)), "utf8").trim();
}
