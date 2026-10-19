// The book's document tree — what a chapter *is*, before a page spells it.
//
// Three stages build the printed edition: `parse.ts` turns a chapter's Markdown
// into this tree, `tex.ts` writes the tree as LaTeX, and `cli.ts` assembles the
// chapters into one document. The tree is what keeps the middle stage honest. It
// names what a book is made of — headings and their anchors, paragraphs of
// inline content, callouts, code panels, tables, drawings, pictures — and leaves
// every LaTeX decision (escaping, environments, measurements) to the serializer,
// which never sees Markdown.
//
// Anchors are the web build's heading ids: `c3` for a chapter and `c3--a-slug`
// for anything under it, so an intra-book link names the same heading in both
// editions. The tree serves the print edition, but nothing in it is LaTeX: a
// serializer for the website could read the same tree.
//
// Pure: no imports outside `domain/`.

import type { Figure, ImageAsset } from "./assets.js";
import type { ImageNode, Inline } from "./inline.js";

/** Where a chapter sits in the book, and what its links resolve against. */
export interface ChapterContext {
  /** Numeric chapter id (`c0`, `c1`, …) — the ids the web build's links use. */
  readonly chapterId: number;
  /** SUMMARY-relative path, e.g. `chapters/01_data_types/02_strings.md`. */
  readonly relBook: string;
  /** Every written chapter's id, keyed by its SUMMARY-relative path. */
  readonly idOf: ReadonlyMap<string, number>;
}

/** One chapter: its blocks, and the files the build has to prepare for them. */
export interface Chapter {
  blocks: Block[];
  /** Drawings of the chapter's mermaid fences, in the order they appear. */
  figures: Figure[];
  /** Book files the build copies into its `figures/` directory. */
  images: ImageAsset[];
}

/**
 * The pieces a chapter is made of, in the order they are read.
 *
 * A picture appears as a block when it stands alone in a paragraph — the common
 * case for a figure — and as inline content when a sentence carries it.
 */
export type Block =
  | HeadingBlock
  | ListBlock
  | TableBlock
  | ImageNode
  /** Prose. */
  | { kind: "paragraph"; content: Inline[] }
  /** A fenced code panel: the fence's language and the code itself. */
  | { kind: "code"; lang: string; code: string }
  /** A quotation, which the printed edition sets as a callout panel. */
  | { kind: "callout"; blocks: Block[] }
  /** A drawing, placed where its fence stood. */
  | { kind: "figure"; figure: Figure }
  /** A horizontal rule. */
  | { kind: "rule" };

/** A heading level: 1 for a chapter title, 2–6 for the sections under it. */
export type HeadingDepth = 1 | 2 | 3 | 4 | 5 | 6;

/** A heading, with the anchors a link may name it by. */
export interface HeadingBlock {
  kind: "heading";
  /** 1 for a chapter title; 2–6 for the sections under it. */
  depth: HeadingDepth;
  text: Inline[];
  /** Labels to hang here: `c3` and `c3--a-slug` on a chapter title, the slug alone below. */
  anchors: string[];
}

/** A numbered or bulleted list; items hold blocks, so an item may be a paragraph. */
export interface ListBlock {
  kind: "list";
  ordered: boolean;
  /** The first number, for a numbered list that does not start at 1. */
  start: number;
  /**
   * Whether the list's items are separated by blank lines. A loose list sets
   * each item's paragraphs as blocks of their own; a tight one sets them as a
   * run with no paragraph around it. The HTML renderer needs the distinction;
   * LaTeX ignores it.
   */
  loose: boolean;
  /** Each item's blocks. */
  items: Block[][];
}

/** Column alignment a table asks for; `null` leaves it to the target. */
export type Align = "left" | "center" | "right" | null;

/** One row of a table: its cells, each a run of inline content. */
export type TableRow = Inline[][];

/** A GFM table. The first row is the header; the rest are body rows. */
export interface TableBlock {
  kind: "table";
  align: Align[];
  header: TableRow;
  rows: TableRow[];
}
