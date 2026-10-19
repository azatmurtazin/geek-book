// The HTML renderer: the book's document tree written as an HTML fragment.
//
// Pure over the model: it reads `Block[]` and `Inline[]` and writes the body of
// a page — no Markdown, no filesystem, no `marked`. The bytes it produces are
// the bytes `marked` used to produce, because the website is frozen against
// them; every whitespace and attribute spelling here is deliberate (see
// `escape.ts` and the notes on each `render`). The links and pictures are
// resolved by the caller through `ctx.href`/`ctx.src`, so a page's own
// `hrefFor`/`srcFor` know where it sits without this module learning about the
// web build.
//
// Not a pure-layer module: it is an adapter, and it imports the domain.

import type {
  Align,
  Block,
  Chapter,
  HeadingBlock,
  ListBlock,
  TableBlock,
  TableRow,
} from "../../domain/model/chapter.js";
import type { ImageNode, Inline, LinkNode } from "../../domain/model/inline.js";
import type { CodeTable } from "../../domain/values/code-language.js";
import { codeLabel } from "../../domain/values/code-language.js";
import { tokenizeCode } from "../../domain/services/code-tokenizer.js";
import { escapeHtml, escapeMarked } from "./escape.js";

/** What the renderer needs to place a page's links and pictures. */
export interface HtmlContext {
  /** The book's code-fence languages: the chip a block shows and its comments. */
  readonly code: CodeTable;
  /** The href a link writes on this page, from the one the source spelled. */
  readonly href: (href: string) => string;
  /** The src a picture writes on this page, from the one the source spelled. */
  readonly src: (src: string) => string;
}

/** One chapter's blocks as an HTML fragment. Pure: no filesystem, no `marked`. */
export function renderChapterBody(chapter: Chapter, ctx: HtmlContext): string {
  return renderBlocks(chapter.blocks, ctx, false);
}

/** The blocks of a chapter or a callout, in order. */
export function renderBlocks(blocks: readonly Block[], ctx: HtmlContext, tight: boolean): string {
  let out = "";
  for (const block of blocks) {
    out += renderBlock(block, ctx, tight);
  }
  return out;
}

/**
 * One block.
 *
 * `tight` is set inside a tight list item, where a run with no paragraph of its
 * own is written bare rather than wrapped in `<p>` — the shape `marked` gave a
 * tight `<li>`.
 */
export function renderBlock(block: Block, ctx: HtmlContext, tight: boolean): string {
  switch (block.kind) {
    case "heading":
      return headingHtml(block, ctx);
    case "paragraph": {
      const inner = renderInline(block.content, ctx);
      return tight ? inner : `<p>${inner}</p>\n`;
    }
    case "code":
      return codeHtml(block.lang, block.code, ctx);
    case "callout":
      return `<blockquote>\n${renderBlocks(block.blocks, ctx, false)}</blockquote>\n`;
    case "list":
      return listHtml(block, ctx);
    case "table":
      return tableHtml(block, ctx);
    case "rule":
      return "<hr>\n";
    case "figure":
      return `<div class="diagram">\n${block.figure.svg}\n</div>\n`;
    case "image":
      return `<p>${imageHtml(block, ctx)}</p>\n`;
  }
}

/**
 * A heading with the page's own id.
 *
 * The id is the bare slug — the anchor carries the chapter prefix (`c3--slug`)
 * so the print edition's labels resolve; the website's id is what is left when
 * the prefix is taken back off. `marked` slugged the same text the same way.
 */
function headingHtml(block: HeadingBlock, ctx: HtmlContext): string {
  const inner = renderInline(block.text, ctx);
  return `<h${block.depth} id="${webId(block.anchors)}">${inner}</h${block.depth}>`;
}

/** `c3--a-slug` (or `c3`) back to the bare `a-slug` the website hangs the id on. */
function webId(anchors: readonly string[]): string {
  for (const anchor of anchors) {
    const match = /^c\d+--([\s\S]*)$/.exec(anchor);
    if (match !== null) return match[1];
  }
  return anchors[0] ?? "";
}

/** A code panel: the fence's label chip, the escaped code, comment runs marked. */
function codeHtml(lang: string, code: string, ctx: HtmlContext): string {
  const highlighted = highlightComments(code, lang, ctx.code);
  const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : "";
  const inner = `<pre><code${langAttr}>${highlighted}</code></pre>`;
  const label = codeLabel(ctx.code, lang);
  return label
    ? `<div class="code-block"><span class="code-label">${escapeHtml(label)}</span>${inner}</div>`
    : inner;
}

/**
 * A code run as HTML, its comment runs wrapped in `<span class="code-comment">`
 * and every character escaped. The rest of a panel is the caller's.
 */
export function highlightComments(code: string, lang: string, table: CodeTable): string {
  let out = "";
  for (const segment of tokenizeCode(table, code, lang)) {
    const escaped = escapeHtml(segment.text);
    out += segment.kind === "comment" ? `<span class="code-comment">${escaped}</span>` : escaped;
  }
  return out;
}

/** A list: `<ul>`/`<ol>`, each item's blocks, tight runs written bare. */
function listHtml(block: ListBlock, ctx: HtmlContext): string {
  const tag = block.ordered ? "ol" : "ul";
  const start = block.ordered && block.start !== 1 ? ` start="${block.start}"` : "";
  let items = "";
  for (const item of block.items) {
    items += `<li>${renderBlocks(item, ctx, !block.loose)}</li>\n`;
  }
  return `<${tag}${start}>\n${items}</${tag}>\n`;
}

/** A GFM table: a header row, a body wrapped in `<tbody>` when it has rows. */
function tableHtml(block: TableBlock, ctx: HtmlContext): string {
  const header = tableRowHtml(block.header, block.align, true, ctx);
  let body = "";
  for (const row of block.rows) {
    body += tableRowHtml(row, block.align, false, ctx);
  }
  const tbody = body ? `<tbody>${body}</tbody>` : "";
  return `<table>\n<thead>\n${header}</thead>\n${tbody}</table>\n`;
}

function tableRowHtml(row: TableRow, align: readonly Align[], header: boolean, ctx: HtmlContext): string {
  const tag = header ? "th" : "td";
  let cells = "";
  row.forEach((cell, index) => {
    const attr = align[index] ? ` align="${align[index]}"` : "";
    cells += `<${tag}${attr}>${renderInline(cell, ctx)}</${tag}>\n`;
  });
  return `<tr>\n${cells}</tr>\n`;
}

/** A run of inline content, in order. */
export function renderInline(nodes: readonly Inline[], ctx: HtmlContext): string {
  let out = "";
  for (const node of nodes) {
    out += inlineHtml(node, ctx);
  }
  return out;
}

function inlineHtml(node: Inline, ctx: HtmlContext): string {
  switch (node.kind) {
    case "text":
      return escapeMarked(node.text);
    case "code":
      return `<code>${escapeMarked(node.text, true)}</code>`;
    case "strong":
      return `<strong>${renderInline(node.content, ctx)}</strong>`;
    case "em":
      return `<em>${renderInline(node.content, ctx)}</em>`;
    case "del":
      return `<del>${renderInline(node.content, ctx)}</del>`;
    case "break":
      return "<br>";
    case "link":
      return linkHtml(node, ctx);
    case "image":
      return imageHtml(node, ctx);
  }
}

/**
 * A link.
 *
 * `marked` first cleaned the href (`encodeURI`, with `%25` left as `%`) and
 * dropped the `<a>` entirely when that failed; the caller then had the cleaned
 * href to rewrite (a `.md` path becomes the page it names). Both are kept here
 * so a link the source spelled oddly renders exactly as it once did.
 */
function linkHtml(node: LinkNode, ctx: HtmlContext): string {
  const inner = renderInline(node.content, ctx);
  const cleaned = cleanUrl(node.href);
  if (cleaned === null) return inner;
  return `<a href="${escapeMarked(ctx.href(cleaned))}">${inner}</a>`;
}

/** A picture: `<img src alt>`, or its alt text when the source has no usable href. */
function imageHtml(node: ImageNode, ctx: HtmlContext): string {
  const alt = escapeMarked(node.alt);
  const cleaned = cleanUrl(node.src);
  if (cleaned === null) return alt;
  return `<img src="${escapeMarked(ctx.src(cleaned))}" alt="${alt}">`;
}

/** `marked`'s `cleanUrl`: `encodeURI`, or `null` when the href cannot be encoded. */
function cleanUrl(href: string): string | null {
  try {
    return encodeURI(href).replace(/%25/g, "%");
  } catch {
    return null;
  }
}
