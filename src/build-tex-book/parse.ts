// Markdown in, the book's tree out (see ir.ts).
//
// These are the two ways in: `tokensToIr` is the pure walk — Markdown in, a
// chapter out, no I/O — and `parseChapter` is the full build path, which is the
// shared `sourceToModel` pipeline (see application/pipelines/source-to-model.ts)
// with this edition's ports: the `marked` parser, the Mermaid renderer, and the
// build's remote-image cache. The Markdown is lexed into the neutral tree by
// the `MarkedParser` adapter, and the walk that gives it the book's meaning
// lives in `domain/services/assemble.ts`; the anchors it gives headings are the
// web build's ids, so a link names the same heading on the site and on the
// page. Placeholders, mermaid fences and remote pictures are the pipeline's
// business now.

import type { BookConfig } from "../lib/book-config.js";
import { substituteContentPlaceholders } from "../lib/content-placeholders.js";
import { MarkedParser } from "../adapters/markdown/marked-parser.js";
import { MermaidRenderer } from "../adapters/diagrams/mermaid-renderer.js";
import { NoRemoteImages } from "../adapters/http/remote-images.js";
import { sourceToModel, type SourceDeps } from "../application/pipelines/source-to-model.js";
import { assemble } from "../domain/services/assemble.js";
import type { Chapter, ChapterContext } from "./ir.js";

const parser = new MarkedParser();

/**
 * The pure middle of {@link parseChapter}: a chapter's tree, with no I/O.
 *
 * The Markdown is what a walk sees — placeholders filled, mermaid fences already
 * swapped for their placeholder paragraphs. A chapter carrying mermaid fences
 * therefore goes through `parseChapter`, which draws them first so the walk can
 * resolve them; without that the placeholder would pass through as prose.
 */
export function tokensToIr(cfg: BookConfig, markdown: string, ctx: ChapterContext): Chapter {
  const nodes = parser.lex(substituteContentPlaceholders(cfg, markdown));
  return assemble(nodes, ctx, {
    bookDir: cfg.bookDir,
    remoteFile: remoteFileFor(ctx),
    smartTypography: cfg.markdown.smartTypography,
  });
}

/** One chapter as a tree, with the files its build has to prepare. */
export async function parseChapter(cfg: BookConfig, source: string, ctx: ChapterContext): Promise<Chapter> {
  const result = await sourceToModel(source, ctx, printDeps(cfg, ctx));
  if (!result.ok) {
    throw new Error(result.diagnostics[0].message);
  }
  return result.value;
}

/** The pipeline's ports for the printed edition. */
function printDeps(cfg: BookConfig, ctx: ChapterContext): SourceDeps {
  return {
    markdown: parser,
    diagrams: new MermaidRenderer(cfg),
    images: ctx.remote ?? new NoRemoteImages(),
    substitute: (source) => substituteContentPlaceholders(cfg, source),
    smartTypography: cfg.markdown.smartTypography,
    bookDir: cfg.bookDir,
    diagramName: (index) => ({
      id: `tex-dgm-${ctx.chapterId}-${index}`,
      name: `c${ctx.chapterId}-d${index}.pdf`,
    }),
  };
}

/** The look-up the walk asks for a fetched remote picture's file, if any. */
function remoteFileFor(ctx: ChapterContext): ((url: string) => string | null) | undefined {
  const remote = ctx.remote;
  return remote === undefined ? undefined : (url) => remote.fileFor(url);
}
