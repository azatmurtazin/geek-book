// A token list as blocks: a chapter, a callout, or one list item.

import type { Token, Tokens } from "marked";
import { markedInstance, plainText, slugify } from "../lib/markdown.js";
import type { BookConfig } from "../lib/book-config.js";
import type { Align, Block, Figure } from "./ir.js";
import type { ParseState } from "./state.js";
import { decodeEntities } from "./entities.js";
import { imageNode } from "./images.js";
import { inlinesOf, text } from "./inlines.js";

/** The walk's entry: prepared Markdown → blocks. No fetching, drawing or reading. */
export function walk(cfg: BookConfig, markdown: string, state: ParseState): Block[] {
  return blocksOf(cfg, markedInstance(cfg).lexer(markdown), state);
}

/** The blocks of a token list: a chapter, a callout, or one list item. */
export function blocksOf(cfg: BookConfig, tokens: Token[], state: ParseState): Block[] {
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

function asAlign(value: string | null | undefined): Align {
  return value === "left" || value === "center" || value === "right" ? value : null;
}
