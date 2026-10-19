// The walk: the neutral Markdown tree becomes the book's document tree.
//
// This is the only place a construct's meaning is decided. It reads the neutral
// tree (`domain/model/markdown.ts`) — no parser types — and produces `Block[]`
// and `Inline[]`: entities decoded, links resolved to the web build's heading
// ids, pictures registered as copies the build must make, mermaid placeholders
// swapped for the drawings the build rendered. It is pure: no I/O, no fetching,
// no drawing, no disk. The files it names are read and copied by the builder
// around it.
//
// It absorbed the print builder's `blocks.ts`, `inlines.ts`, `entities.ts`,
// `links.ts`, `images.ts` and `state.ts`; `AssembleState` is the scratch space
// those once threaded through a `ParseState`.

import type { Figure, ImageAsset } from "../model/assets.js";
import type { Align, Block, Chapter, ChapterContext, HeadingDepth } from "../model/chapter.js";
import type { ImageNode, ImageRef, Inline } from "../model/inline.js";
import type { MdInline, MdNode } from "../model/markdown.js";
import { slugify } from "../values/anchor.js";
import { decodeEntities } from "../values/entities.js";
import { basename, extname, join } from "../values/posix-path.js";
import { applySmartTypography } from "../values/smart-typography.js";
import { resolveImage } from "./resolve-images.js";
import { resolveLink } from "./resolve-links.js";

/** What the walk needs that the chapter context does not carry. */
export interface AssembleOptions {
  /** Absolute path of the book directory; a book-relative picture path joins to it. */
  readonly bookDir: string;
  /** Where a remote source's fetched copy is, or `null`; set by the builder. */
  readonly remoteFile?: (url: string) => string | null;
  /** The chapter's drawings, keyed by the placeholder index that names them, in fence order. */
  readonly diagrams?: ReadonlyMap<number, Figure>;
  /** Whether the prose gets a typographer's punctuation (`markdown.smartTypography`). */
  readonly smartTypography?: boolean;
}

/** What the walk carries along: where it is, and what it has registered. */
interface AssembleState {
  readonly ctx: ChapterContext;
  readonly options: AssembleOptions;
  /** Picture copies, keyed by their path relative to the book. */
  readonly copies: Map<string, string>;
  /** The copies to make, in the order the pictures appear. */
  readonly images: ImageAsset[];
  /** Drawings keyed by the index their placeholder paragraph carries. */
  readonly diagrams: ReadonlyMap<number, Figure>;
}

/**
 * The book's tree for one chapter, with no I/O.
 *
 * The nodes are what a walk sees — placeholders filled, mermaid fences already
 * swapped for their placeholder paragraphs. A chapter carrying mermaid fences
 * therefore also passes `diagrams`, so the walk can resolve those placeholders;
 * without it the placeholder passes through as prose.
 */
export function assemble(nodes: readonly MdNode[], ctx: ChapterContext, options: AssembleOptions): Chapter {
  const state: AssembleState = {
    ctx,
    options,
    copies: new Map(),
    images: [],
    diagrams: options.diagrams ?? new Map(),
  };
  if (options.smartTypography) {
    applySmartTypography(nodes);
  }
  return {
    blocks: blocksOf(nodes, state),
    figures: [...state.diagrams.values()],
    images: state.images,
  };
}

/** The blocks of a node list: a chapter, a callout, or one list item. */
function blocksOf(nodes: readonly MdNode[], state: AssembleState): Block[] {
  const out: Block[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "rule":
        out.push({ kind: "rule" });
        break;
      case "heading": {
        // A chapter title carries two anchors: `c<id>`, which chapter links name,
        // and the slug of its own title, which a link to the heading itself
        // names. Anything below carries the slug alone.
        const slug = `c${state.ctx.chapterId}--${slugify(plainInline(node.inline))}`;
        out.push({
          kind: "heading",
          depth: node.depth as HeadingDepth,
          text: inlineList(node.inline, state),
          anchors: node.depth === 1 ? [`c${state.ctx.chapterId}`, slug] : [slug],
        });
        break;
      }
      case "code":
        out.push({ kind: "code", lang: node.lang.toLowerCase(), code: node.text });
        break;
      case "blockquote":
        out.push({ kind: "callout", blocks: blocksOf(node.children, state) });
        break;
      case "list":
        out.push({
          kind: "list",
          ordered: node.ordered,
          start: node.start,
          loose: node.loose,
          items: node.items.map((item) => blocksOf(item, state)),
        });
        break;
      case "table":
        out.push({
          kind: "table",
          align: node.align.map(asAlign),
          header: node.header.map((cell) => inlineList(cell, state)),
          rows: node.rows.map((row) => row.map((cell) => inlineList(cell, state))),
        });
        break;
      case "paragraph": {
        const figure = diagramFigure(node.inline, state);
        if (figure !== null) {
          out.push({ kind: "figure", figure });
          break;
        }
        const stand = standaloneImage(node.inline);
        if (stand !== null) {
          out.push(imageNode(stand.href, stand.alt, state));
          break;
        }
        out.push({ kind: "paragraph", content: inlineList(node.inline, state) });
        break;
      }
      case "text":
        // A run with no block of its own: prose, never a figure, even when it
        // is nothing but a picture.
        out.push({ kind: "paragraph", content: inlineList(node.inline, state) });
        break;
      case "html":
        out.push({ kind: "paragraph", content: [{ kind: "text", text: decodeEntities(node.text) }] });
        break;
    }
  }
  return out;
}

/** The drawing a paragraph stands in for, when it is a diagram placeholder. */
function diagramFigure(inline: readonly MdInline[], state: AssembleState): Figure | null {
  if (inline.length !== 1 || inline[0].type !== "text") {
    return null;
  }
  const placeholder = /^::gb-diagram-(\d+)::$/.exec(inline[0].text.trim());
  if (placeholder === null) {
    return null;
  }
  return state.diagrams.get(Number(placeholder[1])) ?? null;
}

/** A paragraph holding nothing but an image — the common case for a figure. */
function standaloneImage(inline: readonly MdInline[]): { href: string; alt: string } | null {
  let found: { href: string; alt: string } | null = null;
  for (const node of inline) {
    if (node.type === "image" && found === null) {
      found = { href: node.href, alt: node.alt };
      continue;
    }
    if (textOf(node).trim() === "") {
      continue;
    }
    return null;
  }
  return found;
}

/** The literal text a node spells, as the standalone-image test reads it. */
function textOf(node: MdInline): string {
  switch (node.type) {
    case "text":
    case "code":
    case "html":
      return node.text;
    case "image":
      return node.alt;
    default:
      return "";
  }
}

/** The inline content of a run, in order. */
function inlineList(nodes: readonly MdInline[], state: AssembleState): Inline[] {
  const out: Inline[] = [];
  for (const node of nodes) {
    out.push(...inlineOf(node, state));
  }
  return out;
}

function inlineOf(node: MdInline, state: AssembleState): Inline[] {
  switch (node.type) {
    case "text":
      return [{ kind: "text", text: decodeEntities(node.text) }];
    case "code":
      return [{ kind: "code", text: node.text }];
    case "strong":
      return [{ kind: "strong", content: inlineList(node.children, state) }];
    case "em":
      return [{ kind: "em", content: inlineList(node.children, state) }];
    case "del":
      return [{ kind: "del", content: inlineList(node.children, state) }];
    case "break":
      return [{ kind: "break" }];
    case "link":
      return [
        {
          kind: "link",
          href: node.href,
          target: resolveLink(node.href, state.ctx, state.ctx.idOf),
          content: inlineList(node.children, state),
        },
      ];
    case "image":
      return [imageNode(node.href, node.alt, state)];
    case "html":
      return [{ kind: "text", text: decodeEntities(node.text) }];
  }
}

/** Concatenated text of an inline run — heading labels, for slugs. */
function plainInline(nodes: readonly MdInline[]): string {
  let out = "";
  for (const node of nodes) {
    switch (node.type) {
      case "text":
      case "code":
      case "html":
        out += node.text;
        break;
      case "image":
        out += node.alt;
        break;
      case "strong":
      case "em":
      case "del":
      case "link":
        out += plainInline(node.children);
        break;
      default:
        break;
    }
  }
  return out;
}

/** A picture's node: the source it spelled, the file it points at (or none), and its alt text. */
function imageNode(href: string, alt: string, state: AssembleState): ImageNode {
  return { kind: "image", src: href, ref: placeImage(href, state), alt: decodeEntities(alt) };
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
function placeImage(src: string, state: AssembleState): ImageRef | null {
  const relBook = resolveImage(src, state.ctx.relBook);
  if (relBook === null) {
    const file = state.options.remoteFile?.(src) ?? null;
    return file === null ? null : { file, name: basename(file) };
  }
  const file = join(state.options.bookDir, relBook);
  const known = state.copies.get(relBook);
  if (known !== undefined) {
    return { file, name: known };
  }
  const ext = extname(relBook).toLowerCase() || ".png";
  const name = `c${state.ctx.chapterId}-i${state.images.length}${ext}`;
  state.copies.set(relBook, name);
  state.images.push({ relBook, name });
  return { file, name };
}

function asAlign(value: string | null | undefined): Align {
  return value === "left" || value === "center" || value === "right" ? value : null;
}
