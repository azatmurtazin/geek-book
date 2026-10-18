// The book's document tree — what a chapter *is*, before a page spells it.
//
// The model types now live in `domain/model/`; this is the legacy path and the
// re-export the print builder's stages still name. `ChapterContext` stays here
// for now because it still names `RemoteImages`; it moves in Phase 4.

import type { RemoteImages } from "../lib/remote-images.js";

export type { Figure, ImageAsset, PixelSize } from "../domain/model/assets.js";
export type { ImageNode, ImageRef, Inline, LinkNode } from "../domain/model/inline.js";
export type {
  Align,
  Block,
  Chapter,
  HeadingBlock,
  HeadingDepth,
  ListBlock,
  TableBlock,
  TableRow,
} from "../domain/model/chapter.js";

/** Where a chapter sits in the book, and what its links resolve against. */
export interface ChapterContext {
  /** Numeric chapter id (`c0`, `c1`, …) — the ids the web build's links use. */
  chapterId: number;
  /** SUMMARY-relative path, e.g. `chapters/01_data_types/02_strings.md`. */
  relBook: string;
  /** Every written chapter's id, keyed by its SUMMARY-relative path. */
  idOf: Map<string, number>;
  /** Remote images already fetched for this build (see lib/remote-images.ts). */
  remote?: RemoteImages;
}
