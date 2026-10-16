// The `ChapterContext` a chapter's Markdown is parsed against (see ir.ts):
// where the chapter sits, and which paths its links resolve against. The
// defaults describe a chapter under `chapters/01_start/`, with one sibling
// registered in the book's chapter map, so a link test has something to hit.

import type { ChapterContext } from "../../src/build-tex-book/ir.js";

/** The chapter id the default context parses as. */
export const CHAPTER_ID = 3;

/** A context for a chapter, with the bits a test cares about set explicitly. */
export function chapterContext(over: Partial<ChapterContext> = {}): ChapterContext {
  return {
    chapterId: CHAPTER_ID,
    relBook: "chapters/01_start/02_run.md",
    idOf: new Map([["chapters/01_start/03_next.md", 4]]),
    ...over,
  };
}
