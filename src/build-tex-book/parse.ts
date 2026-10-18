// Markdown in, the book's tree out (see ir.ts).
//
// These are the two ways in: `tokensToIr` is the pure walk — Markdown in, a
// chapter out, no I/O — and `parseChapter` is the full build path around it. The
// Markdown is lexed into the neutral tree by the `MarkedParser` adapter, and the
// walk that gives it the book's meaning lives in `domain/services/assemble.ts`;
// the anchors it gives headings are the web build's ids, so a link names the
// same heading on the site and on the page. Two things happen in the build path
// that belong to no page in particular: `{{ … }}` placeholders are filled in,
// and mermaid fences become drawings (drawn before the Markdown is lexed, so the
// SVG never goes through a Markdown parser); remote pictures are fetched by the
// caller, because a printed book cannot hotlink.

import type { BookConfig } from "../lib/book-config.js";
import { substituteContentPlaceholders } from "../lib/content-placeholders.js";
import { preprocessMermaidMd, renderMermaid } from "../diagrams/render.js";
import { MarkedParser } from "../adapters/markdown/marked-parser.js";
import { assemble } from "../domain/services/assemble.js";
import type { Chapter, ChapterContext, Figure } from "./ir.js";

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
  const substituted = substituteContentPlaceholders(cfg, source);
  // Remote images have to be on disk before the walk reaches them.
  await ctx.remote?.collect(substituted);
  const { markdown, diagrams } = await preprocessMermaidMd(substituted);
  const figures = new Map<number, Figure>();
  for (const [index, diagram] of diagrams) {
    figures.set(index, await mermaidFigure(cfg, diagram, ctx.chapterId, index));
  }
  const nodes = parser.lex(markdown);
  return assemble(nodes, ctx, {
    bookDir: cfg.bookDir,
    remoteFile: remoteFileFor(ctx),
    diagrams: figures,
    smartTypography: cfg.markdown.smartTypography,
  });
}

/** The look-up the walk asks for a fetched remote picture's file, if any. */
function remoteFileFor(ctx: ChapterContext): ((url: string) => string | null) | undefined {
  const remote = ctx.remote;
  return remote === undefined ? undefined : (url) => remote.fileFor(url);
}

/**
 * Draw one fence's diagram.
 *
 * The size comes out of the SVG's viewBox, which is all jsdom can say about a
 * drawing it cannot lay out. A diagram that carries no viewBox keeps a `null`
 * size, and the serializer places it as it sees fit.
 */
async function mermaidFigure(
  cfg: BookConfig,
  source: string,
  chapterId: number,
  index: number
): Promise<Figure> {
  const svg = await renderMermaid(cfg, source, `tex-dgm-${chapterId}-${index}`);
  const viewBox = /viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg);
  return {
    name: `c${chapterId}-d${index}.pdf`,
    svg,
    size: viewBox ? { width: Number(viewBox[3]), height: Number(viewBox[4]) } : null,
  };
}
