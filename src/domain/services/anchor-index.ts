// The anchors a book's chapters declare, and the one rule for naming one.
//
// The website's renderer, the print walk and the linter all have to agree on
// what a link's `#anchor` points at. `assemble` gives every heading its anchors
// (`c3` on a chapter title, `c3--a-slug` below), so an index built from the
// assembled chapters is the single authority: a check that a link resolves is
// the same test the builders make when they place it, and it needs no second
// Markdown parse and no second slug rule.
//
// Pure: no imports outside `domain/`.

import type { Block } from "../model/chapter.js";

/** One chapter's heading anchors, as the walk produced them. */
export interface IndexedChapter {
  /** SUMMARY-relative path, e.g. `chapters/01_start/02_run.md`. */
  readonly relBook: string;
  /** The chapter's number, the `c<id>` both builders give it. */
  readonly id: number;
  /** Every anchor a link may name here: `c3` and `c3--a-slug`. */
  readonly anchors: ReadonlySet<string>;
}

/** What the walk gives a chapter's headings, gathered from its blocks. */
export function chapterAnchors(blocks: readonly Block[]): Set<string> {
  const out = new Set<string>();
  for (const block of blocks) {
    collect(block, out);
  }
  return out;
}

function collect(block: Block, out: Set<string>): void {
  switch (block.kind) {
    case "heading":
      for (const anchor of block.anchors) out.add(anchor);
      break;
    case "callout":
      for (const child of block.blocks) collect(child, out);
      break;
    case "list":
      for (const item of block.items) for (const child of item) collect(child, out);
      break;
    default:
      break;
  }
}

/** The anchors of a book, and the link rule the walk shares with a check. */
export class AnchorIndex {
  private readonly byRelBook = new Map<string, IndexedChapter>();

  constructor(chapters: readonly IndexedChapter[]) {
    for (const chapter of chapters) {
      this.byRelBook.set(chapter.relBook, chapter);
    }
  }

  /** The chapter a book-relative path names, or undefined when it is no chapter. */
  chapter(relBook: string): IndexedChapter | undefined {
    return this.byRelBook.get(relBook);
  }

  /**
   * Whether `relBook` declares the anchor `#anchor` names. A heading's anchor is
   * `c<id>--<slug>`, the spelling `assemble` writes and the builders resolve to;
   * the bare slug is accepted too, so a link written as either resolves.
   */
  hasAnchor(relBook: string, anchor: string): boolean {
    const chapter = this.byRelBook.get(relBook);
    if (chapter === undefined) return false;
    return chapter.anchors.has(`c${chapter.id}--${anchor}`) || chapter.anchors.has(anchor);
  }
}

/** The anchors of a set of chapters, gathered from each one's blocks. */
export function indexAnchors(
  chapters: readonly { readonly relBook: string; readonly id: number; readonly blocks: readonly Block[] }[],
): AnchorIndex {
  return new AnchorIndex(
    chapters.map(({ relBook, id, blocks }) => ({ relBook, id, anchors: chapterAnchors(blocks) })),
  );
}
