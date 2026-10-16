// A fence language's presentation: the label a code block shows and how its
// comments are marked. The book's own `code` map comes first, then the built-in
// table in langs.ts, so a book can teach the renderers a language they do not
// know without forking them. Both the HTML and the LaTeX renderers read this
// through code-tokens.ts and their own label lookup, so a book's language looks
// the same in the website and the PDF.

import { CODE_LABELS, HASH_COMMENT_LANGS, SLASH_COMMENT_LANGS } from "./langs.js";
import type { BookConfig } from "./book-config.js";

/** How comments are introduced in `lang`, or null when it has none. */
export function commentStyle(cfg: BookConfig, lang: string): "slash" | "hash" | null {
  const key = lang.toLowerCase();
  const custom = cfg.code[key]?.comment;
  if (custom === "slash" || custom === "hash") return custom;
  if (SLASH_COMMENT_LANGS.has(key)) return "slash";
  if (HASH_COMMENT_LANGS.has(key)) return "hash";
  return null;
}

/** The chip a code block shows for `lang`, or undefined for none. */
export function codeLabel(cfg: BookConfig, lang: string): string | undefined {
  const key = lang.toLowerCase();
  return cfg.code[key]?.label || CODE_LABELS[key];
}
