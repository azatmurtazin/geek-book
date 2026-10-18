// The chapter tree from book/SUMMARY.md — the single source of truth for what
// the book contains and in what order. Shared by the web-book build, the LaTeX
// book build and the linter, so they all number and group chapters identically.
//
// Pure: no imports outside `domain/`.

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
export type Toc = readonly TocItem[];
