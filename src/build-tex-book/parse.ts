// Markdown in, the book's tree out (see ir.ts).
//
// The walk covers the same marked tokens the HTML renderer walks, and the
// anchors it gives headings are the web build's ids, so a link names the same
// heading on the site and on the page. Three things happen here that belong to
// no page in particular: `{{ … }}` placeholders are filled in, mermaid fences
// become drawings (drawn before the Markdown is lexed, so the SVG never goes
// through a Markdown parser), and remote pictures are fetched, because a printed
// book cannot hotlink.
//
// What is left is the book itself: decoded text, resolved links, registered
// pictures. Nothing here knows how any of it looks.

import path from "node:path";
import type { Token, Tokens } from "marked";
import { markedInstance, plainText, slugify } from "../lib/markdown.js";
import { resolveImagePath } from "../lib/images.js";
import type { BookConfig } from "../lib/book-config.js";
import { substituteContentPlaceholders } from "../lib/content-placeholders.js";
import { preprocessMermaidMd, renderMermaid } from "../diagrams/render.js";
import type {
  Align,
  Block,
  Chapter,
  ChapterContext,
  Figure,
  ImageAsset,
  ImageNode,
  ImageRef,
  Inline,
} from "./ir.js";

/** What the walk carries along: where it is, and what it has registered. */
interface ParseState {
  ctx: ChapterContext;
  /** Picture copies, keyed by their path relative to the book. */
  copies: Map<string, string>;
  /** The copies to make, in the order the pictures appear. */
  images: ImageAsset[];
  /** Every drawing of the chapter, in order. */
  figures: Figure[];
  /** Drawings keyed by the index their placeholder paragraph carries. */
  byIndex: Map<number, Figure>;
}

/** The walk's scratch space: where it is, and what it has registered. */
function freshState(ctx: ChapterContext): ParseState {
  return {
    ctx,
    copies: new Map(),
    images: [],
    figures: [],
    byIndex: new Map(),
  };
}

/** The walk itself: prepared Markdown → blocks. No fetching, drawing or reading. */
function walk(cfg: BookConfig, markdown: string, state: ParseState): Block[] {
  return blocksOf(cfg, markedInstance(cfg).lexer(markdown), state);
}

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

/** The blocks of a token list: a chapter, a callout, or one list item. */
function blocksOf(cfg: BookConfig, tokens: Token[], state: ParseState): Block[] {
  const out: Block[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case "space":
        break;
      case "hr":
        out.push({ kind: "rule" });
        break;
      case "heading": {
        const t = token as Tokens.Heading;
        // A chapter title carries two anchors: `c<id>`, which chapter links name,
        // and the slug of its own title, which a link to the heading itself
        // names. Anything below carries the slug alone.
        const slug = `c${state.ctx.chapterId}--${slugify(plainText(t.tokens))}`;
        out.push({
          kind: "heading",
          depth: t.depth,
          text: inlinesOf(cfg, t.tokens, state),
          anchors: t.depth === 1 ? [`c${state.ctx.chapterId}`, slug] : [slug],
        });
        break;
      }
      case "code": {
        const t = token as Tokens.Code;
        out.push({ kind: "code", lang: (t.lang ?? "").toLowerCase(), code: t.text });
        break;
      }
      case "blockquote":
        out.push({ kind: "callout", blocks: blocksOf(cfg, (token as Tokens.Blockquote).tokens, state) });
        break;
      case "list": {
        const t = token as Tokens.List;
        out.push({
          kind: "list",
          ordered: t.ordered === true,
          start: Number(t.start || 1),
          items: t.items.map((item) => blocksOf(cfg, item.tokens, state)),
        });
        break;
      }
      case "table": {
        const t = token as Tokens.Table;
        out.push({
          kind: "table",
          align: t.align.map(asAlign),
          header: t.header.map((cell) => inlinesOf(cfg, cell.tokens, state)),
          rows: t.rows.map((row) => row.map((cell) => inlinesOf(cfg, cell.tokens, state))),
        });
        break;
      }
      case "paragraph": {
        const t = token as Tokens.Paragraph;
        const figure = diagramFigure(t, state);
        if (figure !== null) {
          out.push({ kind: "figure", figure });
          break;
        }
        const stand = standaloneImage(t.tokens ?? []);
        if (stand !== null) {
          out.push(imageNode(cfg, stand, state));
          break;
        }
        out.push({ kind: "paragraph", content: inlinesOf(cfg, t.tokens ?? [], state) });
        break;
      }
      case "text": {
        const t = token as Tokens.Text;
        out.push({
          kind: "paragraph",
          content: t.tokens?.length ? inlinesOf(cfg, t.tokens, state) : [text(decodeEntities(t.text))],
        });
        break;
      }
      case "html":
        out.push({ kind: "paragraph", content: [text(decodeEntities((token as Tokens.HTML).text))] });
        break;
      default:
        break;
    }
  }
  return out;
}

/** The drawing a paragraph stands in for, when it is a diagram placeholder. */
function diagramFigure(paragraph: Tokens.Paragraph, state: ParseState): Figure | null {
  const placeholder = /^::gb-diagram-(\d+)::$/.exec(paragraph.text.trim());
  if (placeholder === null) {
    return null;
  }
  return state.byIndex.get(Number(placeholder[1])) ?? null;
}

/** A paragraph holding nothing but an image — the common case for a figure. */
function standaloneImage(tokens: Token[]): Tokens.Image | null {
  let found: Tokens.Image | null = null;
  for (const token of tokens) {
    if (token.type === "image" && found === null) {
      found = token as Tokens.Image;
      continue;
    }
    const text = token as { type?: string; text?: string };
    if (text.type === "space" || (text.text ?? "").trim() === "") {
      continue;
    }
    return null;
  }
  return found;
}

function inlinesOf(cfg: BookConfig, tokens: Token[], state: ParseState): Inline[] {
  const out: Inline[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case "text": {
        const t = token as Tokens.Text;
        out.push(...(t.tokens?.length ? inlinesOf(cfg, t.tokens, state) : [text(decodeEntities(t.text))]));
        break;
      }
      case "escape":
        out.push(text((token as Tokens.Escape).text));
        break;
      case "codespan":
        out.push({ kind: "code", text: (token as Tokens.Codespan).text });
        break;
      case "strong":
        out.push({ kind: "strong", content: inlinesOf(cfg, (token as Tokens.Strong).tokens, state) });
        break;
      case "em":
        out.push({ kind: "em", content: inlinesOf(cfg, (token as Tokens.Em).tokens, state) });
        break;
      case "del":
        out.push({ kind: "del", content: inlinesOf(cfg, (token as Tokens.Del).tokens, state) });
        break;
      case "br":
        out.push({ kind: "break" });
        break;
      case "html":
        out.push(text(decodeEntities((token as Tokens.HTML | Tokens.Tag).text)));
        break;
      case "image":
        out.push(imageNode(cfg, token as Tokens.Image, state));
        break;
      case "link": {
        const t = token as Tokens.Link;
        out.push({
          kind: "link",
          href: t.href ?? "",
          target: linkTarget(t.href ?? "", state.ctx),
          content: inlinesOf(cfg, t.tokens, state),
        });
        break;
      }
      default:
        out.push(text(decodeEntities((token as { text?: string }).text ?? "")));
    }
  }
  return out;
}

/** A piece of literal text in the flow. */
function text(value: string): Inline {
  return { kind: "text", text: value };
}

function imageNode(cfg: BookConfig, token: Tokens.Image, state: ParseState): ImageNode {
  return {
    kind: "image",
    ref: placeImage(cfg, token.href ?? "", state),
    alt: decodeEntities(token.text),
  };
}

/**
 * Where a picture's file is, registering the copy the build has to make.
 *
 * A book file is copied into the build's `figures/` directory under a generated
 * name, so the LaTeX never spells out a path into the repo (or a file name with
 * characters TeX dislikes); one copy per source per chapter, repeats reuse it. A
 * remote source was fetched into that same directory before the walk — a scheme
 * nothing fetches (data:, mailto:) has no file, and the picture falls back to
 * its alt text.
 */
function placeImage(cfg: BookConfig, src: string, state: ParseState): ImageRef | null {
  const relBook = resolveImagePath(src, state.ctx.relBook);
  if (relBook === null) {
    const file = state.ctx.remote?.fileFor(src) ?? null;
    return file === null ? null : { file, name: path.basename(file) };
  }
  const file = path.join(cfg.bookDir, relBook);
  const known = state.copies.get(relBook);
  if (known !== undefined) {
    return { file, name: known };
  }
  const ext = path.extname(relBook).toLowerCase() || ".png";
  const name = `c${state.ctx.chapterId}-i${state.images.length}${ext}`;
  state.copies.set(relBook, name);
  state.images.push({ relBook, name });
  return { file, name };
}

/**
 * The place in the book a link points at, or `null` for an outside URL.
 *
 * Intra-book targets are the same ids the web build gives its headings: relative
 * `.md` paths resolve against the chapter's own directory through the book's
 * chapter map, and a bare `#anchor` names a heading of this chapter.
 */
function linkTarget(href: string, ctx: ChapterContext): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return null;
  const hash = href.indexOf("#");
  const rawPath = hash === -1 ? href : href.slice(0, hash);
  const anchor = hash === -1 ? "" : href.slice(hash + 1);
  if (rawPath === "") {
    return anchor === "" ? null : `c${ctx.chapterId}--${anchor}`;
  }
  if (!rawPath.toLowerCase().endsWith(".md")) return null;
  const fromDir = path.posix.dirname(ctx.relBook);
  const targetId = ctx.idOf.get(path.posix.normalize(path.posix.join(fromDir, rawPath)));
  if (targetId === undefined) return null;
  return anchor === "" ? `c${targetId}` : `c${targetId}--${anchor}`;
}

function asAlign(value: string | null | undefined): Align {
  return value === "left" || value === "center" || value === "right" ? value : null;
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&nbsp;": "\u00a0",
};

function decodeEntities(str: string): string {
  return str.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => ENTITIES[m] ?? m);
}
