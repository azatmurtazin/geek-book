// One path from raw Markdown to a Chapter model.
//
// Both builders ordered the same five steps themselves, slightly differently:
// fill placeholders, fetch remote images, extract mermaid fences, lex the
// source, assemble the tree. They happen once here, in one order, so the two
// editions cannot drift. Which parser, renderer and store stand behind the
// ports is the composition root's business.
//
// The order is the one the printed edition already used — substitute, fetch,
// extract, lex, draw, assemble — because substituting after the fences were
// extracted (or fetching after lexing) could change what a link or a figure
// resolves to.

import type { Figure } from "../../domain/model/assets.js";
import type { Chapter, ChapterContext } from "../../domain/model/chapter.js";
import { fail, ok, type Result } from "../../domain/diagnostics.js";
import { assemble } from "../../domain/services/assemble.js";
import { extractDiagrams } from "../../domain/services/extract-diagrams.js";
import { applySmartTypography } from "../../domain/values/smart-typography.js";
import type { DiagramRenderer } from "../ports/diagram-renderer.js";
import type { ImageStore } from "../ports/image-store.js";
import type { MarkdownParser } from "../ports/markdown-parser.js";

/** How a chapter's drawings are named: the render inside the SVG, and the file. */
export interface DiagramName {
  /** Names the render inside the SVG; the two editions use different ids. */
  readonly id: string;
  /** The figure's output base name, e.g. `c3-d0.pdf`. */
  readonly name: string;
}

/** What the pipeline needs; the builder supplies each port. */
export interface SourceDeps {
  readonly markdown: MarkdownParser;
  readonly diagrams: DiagramRenderer;
  readonly images: ImageStore;
  /** Fill `{{ … }}` placeholders, leaving fenced code byte-for-byte. */
  readonly substitute: (source: string) => string;
  /** Whether the prose gets a typographer's punctuation (`markdown.smartTypography`). */
  readonly smartTypography: boolean;
  /** Absolute path of the book directory, to locate book pictures. */
  readonly bookDir: string;
  /** Name the fence at `index` (`1`, `2`, …): its mermaid id and its figure. */
  readonly diagramName: (index: number) => DiagramName;
}

/**
 * A chapter, plus what a renderer that still works from Markdown needs: the
 * source with placeholders filled and fences swapped for their placeholders,
 * and the drawn SVG for each. Phase 5's HTML renderer reads the `chapter`
 * alone; until then the website spells its pages from these two faces.
 */
export interface SourceModel {
  readonly chapter: Chapter;
  readonly markdown: string;
  readonly diagrams: ReadonlyMap<number, string>;
}

/**
 * Raw Markdown → a Chapter, with every asset the build must prepare already
 * registered. A remote image the build could not fetch comes back as a
 * diagnostic; the caller prints it.
 */
export async function sourceToModel(
  source: string,
  ctx: ChapterContext,
  deps: SourceDeps,
): Promise<Result<SourceModel>> {
  const substituted = deps.substitute(source);
  try {
    // Remote images have to be on disk before the walk reaches them.
    await deps.images.collect(substituted);
  } catch (error) {
    return fail({ severity: "error", code: "image/fetch", message: (error as Error).message });
  }
  const { markdown, diagrams } = extractDiagrams(substituted);
  const nodes = deps.markdown.lex(markdown);
  if (deps.smartTypography) {
    applySmartTypography(nodes);
  }
  const figures = new Map<number, Figure>();
  const rendered = new Map<number, string>();
  for (const [index, diagramSource] of diagrams) {
    const { id, name } = deps.diagramName(index);
    const figure = await deps.diagrams.render(diagramSource, id, name);
    figures.set(index, figure);
    rendered.set(index, figure.svg);
  }
  const chapter = assemble(nodes, ctx, {
    bookDir: deps.bookDir,
    remoteFile: (url) => deps.images.lookup(url)?.file ?? null,
    diagrams: figures,
  });
  return ok({ chapter, markdown, diagrams: rendered });
}
