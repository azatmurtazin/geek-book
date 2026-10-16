// The walk's scratch space (see parse.ts): where the chapter is, and what the
// walk has registered as it goes. It threads through every step that visits
// tokens — blocks, inlines, links, pictures — so they share one notion of "what
// has been seen so far", rather than each carrying its own ledger.

import type { ChapterContext, Figure, ImageAsset } from "./ir.js";

/** What the walk carries along: where it is, and what it has registered. */
export interface ParseState {
  ctx: ChapterContext;
  /** Picture copies, keyed by their path relative to the book. */
  copies: Map<string, string>;
  /** The copies to make, in the order the pictures appear. */
  images: ImageAsset[];
  /** Every drawing of the chapter, in order. */
  figures: Figure[];
  /** Drawings keyed by the index their placeholder paragraph carries. */
  byIndex: Map<number, Figure>;
}

/** A state for a fresh walk of one chapter. */
export function freshState(ctx: ChapterContext): ParseState {
  return {
    ctx,
    copies: new Map(),
    images: [],
    figures: [],
    byIndex: new Map(),
  };
}
