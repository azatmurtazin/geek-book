// The chapter tree from book/SUMMARY.md — the single source of truth for what
// the book contains and in what order. Shared by the web-book build, the LaTeX
// book build and the linter, so they all number and group chapters identically.

export interface TocItem {
  kind: "group" | "entry";
  title?: string;
  /** entry only */
  label?: string;
  relBook?: string;
  indent?: number;
  /** 1-based line in SUMMARY.md; the linter uses it to point at problems. */
  line?: number;
}

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
