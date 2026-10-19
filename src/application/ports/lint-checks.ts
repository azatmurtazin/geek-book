// The LintChecks port: the four families of source checks, behind one seam.
//
// The checks themselves are text analysis with a lot of house style baked in
// (the 80-column diagram budget, the `00_index.md` convention, the schema), so
// they live in an adapter (`adapters/lint/book-checks.ts`). The use case owns
// the shape of a lint run: which families were asked for, in what order they
// see the book, and the one file list they all share. Findings come back as
// three plain message lists — no stream, no exit code, no formatting.

import type { BookSettings } from "../settings.js";

/** The check families, as `geek-book lint` names them. */
export type LintFamily = "summary" | "chapters" | "links" | "config";

/** Every family, in the order a full run visits them. */
export const LINT_FAMILIES: readonly LintFamily[] = ["summary", "chapters", "links", "config"];

/** What the checks collect: messages already carrying their `file:line: ` locus. */
export interface LintOutput {
  readonly errors: string[];
  readonly warnings: string[];
  readonly notes: string[];
}

export interface LintChecks {
  /**
   * The chapter paths SUMMARY.md lists, relative to the book directory, and a
   * missing SUMMARY.md reported as an error. Every family shares this list.
   */
  plan(settings: BookSettings, out: LintOutput): string[];
  /**
   * The files to check: the planned chapters that exist, then any unlisted
   * `.md` file under the prose directory (a stray is itself a finding).
   */
  written(settings: BookSettings, planned: readonly string[]): string[];
  /** The chapter tree against the prose: what is listed, missing or unlisted. */
  summary(settings: BookSettings, out: LintOutput, planned: readonly string[]): void;
  /** One chapter file's structure: headings, fences, width, housekeeping. */
  chapter(settings: BookSettings, out: LintOutput, file: string): void;
  /** Internal links and anchors across the book, including SUMMARY and the docs. */
  links(
    settings: BookSettings,
    out: LintOutput,
    written: readonly string[],
    planned: ReadonlySet<string>,
  ): void;
  /** book.config.json against book.schema.json (advisory, warnings only). */
  config(settings: BookSettings, out: LintOutput): void;
}
