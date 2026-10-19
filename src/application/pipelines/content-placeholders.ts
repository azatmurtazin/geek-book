// Build-time placeholders available inside chapter Markdown, so one source
// reads correctly in both the website and the printed book.
//
// The substitution rule lives in `domain/values/placeholders.ts`; this is where
// a `BookSettings` becomes the placeholder map. Fenced code blocks are left
// byte-for-byte, and only the known keys are replaced — anything else, such as
// Go's `{{.}}`, passes through.

import { substitute, type PlaceholderMap } from "../../domain/values/placeholders.js";
import type { BookSettings } from "../settings.js";

function placeholders(settings: BookSettings): PlaceholderMap {
  return {
    // A book's own tokens first, so the built-in keys below win on a clash.
    ...settings.placeholders,
    version: settings.version,
    title: settings.title,
    author: settings.author,
    tagline: settings.tagline,
  };
}

/**
 * Fill the content placeholders in a chapter's Markdown. Both renderers call
 * this before parsing, so the site and the book substitute identically.
 */
export function substituteContentPlaceholders(settings: BookSettings, source: string): string {
  return substitute(placeholders(settings), source);
}
