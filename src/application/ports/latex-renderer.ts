// The port the printed book renders its LaTeX through.
//
// LaTeX is a typesetting technology, so it lives in an adapter
// (`adapters/render-tex/tex-renderer.ts`); the build use case names only the
// four pieces a document is made of. The preamble and the front matter read
// files the adapter knows about, so `preamble` answers with a `Result`: a book
// naming a `tex.preamble` file that is not there is a failure, not a throw.

import type { Result } from "../../domain/diagnostics.js";
import type { Chapter } from "../../domain/model/chapter.js";
import type { BookSettings } from "../settings.js";

/** What the serializer needs that the tree does not carry. */
export interface ChapterTexOptions {
  /** TOC indent level: 0 for a part index, 1 for an indented SUMMARY entry. */
  readonly tocDepth?: number;
  /** Plain-text title for the running head (the SUMMARY label). */
  readonly runningTitle?: string;
}

export interface LatexRenderer {
  /** Everything before `\begin{document}`, including the book's own extra LaTeX. */
  preamble(settings: BookSettings): Result<string>;
  /** Everything before the table of contents: cover, title and imprint pages. */
  frontMatter(settings: BookSettings, buildDir: string): string;
  /** One chapter's LaTeX body. */
  chapter(settings: BookSettings, chapter: Chapter, options?: ChapterTexOptions): string;
  /** A SUMMARY group's table-of-contents line, between two chapters. */
  groupHeading(title: string): string;
}
