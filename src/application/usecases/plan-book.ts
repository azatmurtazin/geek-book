// The book's plan: which chapters are written, in what order, with what ids.
//
// Both editions read the same SUMMARY.md and number the chapters the same way
// (`c0`, `c1`, … → the anchors `c0--a-slug`), so an intra-book link resolves
// identically on the website and in the printed book. That shared step lives
// here, once; the website build layers page names and the sidebar on top, the
// print build layers figures on top.

import { fail, ok, type Result } from "../../domain/diagnostics.js";
import type { TocItem } from "../../domain/model/toc.js";
import { parseSummary } from "../../domain/services/summary.js";
import { join } from "../../domain/values/posix-path.js";
import type { FileSystem } from "../ports/file-system.js";
import type { BookSettings } from "../settings.js";

/** A chapter the book lists and has on disk. */
export interface PlannedChapter {
  /** The chapter's number, 0-based: the `c<id>` both editions anchor to. */
  readonly id: number;
  /** Path relative to the book directory, e.g. `chapters/01_writing.md`. */
  readonly relBook: string;
  readonly label: string;
  readonly indent: number;
  /** Absolute path of the chapter's Markdown file. */
  readonly file: string;
}

export interface BookPlan {
  /** Every SUMMARY.md item, groups included, in order. */
  readonly items: readonly TocItem[];
  /** The listed chapters that have a file on disk, in reading order. */
  readonly chapters: readonly PlannedChapter[];
  /** A chapter's number, by its book-relative path. */
  readonly idOf: ReadonlyMap<string, number>;
}

/**
 * Read the book's SUMMARY.md and pair it with the files that exist.
 *
 * A listed chapter with no file is skipped, not an error: a tree may be written
 * ahead of the prose. A book with no SUMMARY.md, or none of whose chapters are
 * written, is the two failures a build reports.
 */
export function planBook(fs: FileSystem, settings: BookSettings): Result<BookPlan> {
  const source = fs.readText(settings.summary);
  if (source === null) {
    return fail({
      severity: "error",
      code: "book/no-summary",
      message: `no SUMMARY.md at ${settings.summary}`,
    });
  }

  const items = parseSummary(source);
  const chapters: PlannedChapter[] = [];
  const idOf = new Map<string, number>();
  for (const item of items) {
    if (item.kind !== "entry" || !item.relBook) {
      continue;
    }
    const file = join(settings.bookDir, item.relBook);
    if (!fs.exists(file)) {
      continue;
    }
    idOf.set(item.relBook, chapters.length);
    chapters.push({
      id: chapters.length,
      relBook: item.relBook,
      label: item.label ?? item.relBook,
      indent: item.indent ?? 0,
      file,
    });
  }

  if (chapters.length === 0) {
    return fail({
      severity: "error",
      code: "book/no-chapters",
      message: "no written chapters in SUMMARY.md",
    });
  }
  return ok({ items, chapters, idOf });
}
