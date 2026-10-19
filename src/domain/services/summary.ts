// The chapter tree from book/SUMMARY.md — the single source of truth for what
// the book contains and in what order. Shared by the website build, the print
// build and the linter, so they all number and group chapters identically.
//
// Pure: part of `domain/`, imports nothing outside `domain/`.

import type { TocItem } from "../model/toc.js";

export type { Toc, TocItem } from "../model/toc.js";

/** Every group heading and chapter entry in SUMMARY.md, in order. */
export function parseSummary(source: string): TocItem[] {
  const items: TocItem[] = [];
  let firstHeading = true;
  for (const [idx, line] of source.split(/\r?\n/).entries()) {
    const heading = /^#\s+(.+)$/.exec(line);
    if (heading) {
      if (firstHeading) {
        firstHeading = false; // skip the "# Summary" title itself
        continue;
      }
      items.push({ kind: "group", title: heading[1].trim(), line: idx + 1 });
      continue;
    }
    const entry = /^(\s*)-\s+\[([^\]]+)\]\(([^)]+)\)/.exec(line);
    if (entry) {
      items.push({
        kind: "entry",
        label: entry[2],
        relBook: entry[3],
        indent: entry[1].length,
        line: idx + 1,
      });
    }
  }
  return items;
}
