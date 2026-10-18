// The chapter tree from book/SUMMARY.md — the single source of truth for what
// the book contains and in what order. Shared by the web-book build, the LaTeX
// book build and the linter, so they all number and group chapters identically.
//
// The types live in `domain/model/toc.ts`; this is the legacy path and the
// parser that reads SUMMARY.md into them.

import type { TocItem } from "../domain/model/toc.js";

export type { Toc, TocItem } from "../domain/model/toc.js";

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
