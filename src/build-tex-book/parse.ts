// Markdown in, the book's tree out (see ir.ts).
//
// These are the two ways in: `tokensToIr` is the pure walk — Markdown in, a
// chapter out, no I/O — and `parseChapter` is the full build path around it. The
// walk covers the same marked tokens the HTML renderer walks, and the anchors it
// gives headings are the web build's ids, so a link names the same heading on the
// site and on the page. Three things happen in the build path that belong to no
// page in particular: `{{ … }}` placeholders are filled in, mermaid fences become
// drawings (drawn before the Markdown is lexed, so the SVG never goes through a
// Markdown parser), and remote pictures are fetched, because a printed book
// cannot hotlink.
//
// The walk itself lives in blocks.ts, its pieces in inlines.ts, links.ts,
// images.ts, entities.ts and state.ts. What comes back is the book itself:
// decoded text, resolved links, registered pictures. Nothing here knows how any
// of it looks.

import type { BookConfig } from "../lib/book-config.js";
import { substituteContentPlaceholders } from "../lib/content-placeholders.js";
import { preprocessMermaidMd, renderMermaid } from "../diagrams/render.js";
import type { Chapter, ChapterContext, Figure } from "./ir.js";
import { freshState } from "./state.js";
import { walk } from "./blocks.js";

/**
 * The pure middle of {@link parseChapter}: a chapter's tree, with no I/O.
 *
 * The Markdown is what a walk sees — placeholders filled, mermaid fences already
 * swapped for their placeholder paragraphs. A chapter carrying mermaid fences
 * therefore goes through `parseChapter`, which draws them first so the walk can
 * resolve them; without that the placeholder would pass through as prose.
 */
export function tokensToIr(cfg: BookConfig, markdown: string, ctx: ChapterContext): Chapter {
  const state = freshState(ctx);
  return {
    blocks: walk(cfg, substituteContentPlaceholders(cfg, markdown), state),
    figures: state.figures,
    images: state.images,
  };
}

/** One chapter as a tree, with the files its build has to prepare. */
export async function parseChapter(cfg: BookConfig, source: string, ctx: ChapterContext): Promise<Chapter> {
  const substituted = substituteContentPlaceholders(cfg, source);
  // Remote images have to be on disk before the walk reaches them.
  await ctx.remote?.collect(substituted);
  const { markdown, diagrams } = await preprocessMermaidMd(substituted);
  const state = freshState(ctx);
  for (const [index, diagram] of diagrams) {
    const figure = await mermaidFigure(cfg, diagram, ctx.chapterId, index);
    state.figures.push(figure);
    state.byIndex.set(index, figure);
  }
  return {
    blocks: walk(cfg, markdown, state),
    figures: state.figures,
    images: state.images,
  };
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
