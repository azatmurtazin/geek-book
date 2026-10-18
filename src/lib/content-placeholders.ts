// Build-time placeholders available inside chapter Markdown, so one source
// reads correctly in both the website and the printed book.
//
// The substitution rule lives in `domain/values/placeholders.ts`; this is the
// legacy path, and the one place that turns a `BookConfig` into the placeholder
// map. Fenced code blocks are left byte-for-byte, and only the known keys are
// replaced — anything else, such as Go's `{{.}}`, passes through.

import type { BookConfig } from "./book-config.js";
import { substitute, type PlaceholderMap } from "../domain/values/placeholders.js";

function placeholders(cfg: BookConfig): PlaceholderMap {
  return {
    // A book's own tokens first, so the built-in keys below win on a clash.
    ...cfg.placeholders,
    version: cfg.version,
    title: cfg.title,
    author: cfg.author,
    tagline: cfg.tagline,
  };
}

/**
 * Fill the content placeholders in a chapter's Markdown. Both renderers call
 * this before parsing, so the site and the book substitute identically.
 */
export function substituteContentPlaceholders(cfg: BookConfig, source: string): string {
  return substitute(placeholders(cfg), source);
}
