// The neutral Markdown tree: a document as any parser might hand it over.
//
// The print and web builders both read Markdown, and neither should know which
// parser produced it. This is the vocabulary they share — headings and
// paragraphs of inline content, code, callouts, lists, tables, rules, raw HTML
// — with no `marked` type and no meaning beyond "the source said this". The
// `MarkdownParser` port produces it (see `application/ports/markdown-parser.ts`)
// and `domain/services/assemble.ts` gives it the book's meaning.
//
// It lives in the domain (the port re-exports it) because the domain services
// that consume it may not import the application layer; the port is the
// application's name for the same types.
//
// A few details are not in CLEAN_CODE_ARCHITECTURE.md §7.1, and are here so the
// port reproduces `marked` exactly: a fenced block records whether `marked`
// already escaped its text (`escaped`); text a backslash escaped carries
// `verbatim` so the typographer leaves it as written; and a tight list item's
// run is a `text` node of its own, which the walk keeps as prose rather than
// promoting to a figure.
//
// Pure: imports nothing outside `domain/`.

import type { Align } from "./chapter.js";

/** A block of a document: the pieces a chapter is read as, in order. */
export type MdNode =
  | { type: "heading"; depth: number; inline: readonly MdInline[] }
  | { type: "paragraph"; inline: readonly MdInline[] }
  /** A run with no block of its own — a tight list item's content. */
  | { type: "text"; inline: readonly MdInline[] }
  | { type: "code"; lang: string; text: string; escaped: boolean }
  | { type: "blockquote"; children: readonly MdNode[] }
  | { type: "list"; ordered: boolean; start: number; items: readonly (readonly MdNode[])[] }
  | {
      type: "table";
      align: readonly Align[];
      header: readonly (readonly MdInline[])[];
      rows: readonly (readonly (readonly MdInline[])[])[];
    }
  | { type: "rule" }
  | { type: "html"; text: string };

/** A run of inline content: the text of a paragraph, heading, cell or item. */
export type MdInline =
  | { type: "text"; text: string; /** Escaped by a backslash: not the typographer's to touch. */ verbatim?: boolean }
  | { type: "code"; text: string }
  | { type: "strong"; children: readonly MdInline[] }
  | { type: "em"; children: readonly MdInline[] }
  | { type: "del"; children: readonly MdInline[] }
  | { type: "break" }
  | { type: "link"; href: string; children: readonly MdInline[] }
  | { type: "image"; href: string; alt: string }
  | { type: "html"; text: string };
