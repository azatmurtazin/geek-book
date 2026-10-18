// The `marked` adapter: the one place in the tree that knows `marked`.
//
// It turns `marked`'s token stream into the neutral document tree (see
// `domain/model/markdown.ts`), faithfully enough that the walk over the neutral
// tree produces exactly what the walk over `marked` tokens produced: code
// keeps its text and whether `marked` already escaped it, pictures and links
// carry their raw `href` and alt, raw HTML passes through, and text a backslash
// escaped is flagged so the typographer leaves it as written. It decodes no
// entities, resolves no links and gives no heading an id — those are the walk's
// and the renderers' business.

import { Marked } from "marked";
import type { Token, Tokens } from "marked";
import type { MarkdownParser, MdInline, MdNode } from "../../application/ports/markdown-parser.js";
import type { Align } from "../../domain/model/chapter.js";

/** Lex Markdown with `marked`, into the neutral tree. */
export class MarkedParser implements MarkdownParser {
  private readonly marked = new Marked({ gfm: true });

  lex(source: string): MdNode[] {
    return this.blocks(this.marked.lexer(source));
  }

  /** The blocks of a token list: a document, a callout, or one list item. */
  private blocks(tokens: readonly Token[]): MdNode[] {
    const out: MdNode[] = [];
    for (const token of tokens) {
      const node = this.block(token);
      if (node !== null) {
        out.push(node);
      }
    }
    return out;
  }

  private block(token: Token): MdNode | null {
    switch (token.type) {
      case "heading": {
        const t = token as Tokens.Heading;
        return { type: "heading", depth: t.depth, inline: this.inlines(t.tokens) };
      }
      case "code": {
        const t = token as Tokens.Code;
        return { type: "code", lang: t.lang ?? "", text: t.text, escaped: t.escaped === true };
      }
      case "blockquote":
        return { type: "blockquote", children: this.blocks((token as Tokens.Blockquote).tokens) };
      case "list": {
        const t = token as Tokens.List;
        return {
          type: "list",
          ordered: t.ordered === true,
          start: Number(t.start || 1),
          items: t.items.map((item) => this.blocks(item.tokens)),
        };
      }
      case "table": {
        const t = token as Tokens.Table;
        return {
          type: "table",
          align: t.align.map(asAlign),
          header: t.header.map((cell) => this.inlines(cell.tokens)),
          rows: t.rows.map((row) => row.map((cell) => this.inlines(cell.tokens))),
        };
      }
      case "paragraph":
        return { type: "paragraph", inline: this.inlines((token as Tokens.Paragraph).tokens ?? []) };
      case "text": {
        // A top-level text token — a tight list item, above all — is a run with
        // no block of its own; the walk must not promote it to a figure.
        const t = token as Tokens.Text;
        return { type: "text", inline: t.tokens?.length ? this.inlines(t.tokens) : [text(t.text)] };
      }
      case "hr":
        return { type: "rule" };
      case "html":
        return { type: "html", text: (token as Tokens.HTML).text };
      default:
        // `space` and anything else carry no block of their own.
        return null;
    }
  }

  private inlines(tokens: readonly Token[]): MdInline[] {
    const out: MdInline[] = [];
    for (const token of tokens) {
      out.push(...this.inline(token));
    }
    return out;
  }

  private inline(token: Token): MdInline[] {
    switch (token.type) {
      case "text": {
        // A text token may wrap further inline tokens; flatten them in place.
        const t = token as Tokens.Text;
        return t.tokens?.length ? this.inlines(t.tokens) : [text(t.text)];
      }
      case "escape":
        return [{ type: "text", text: (token as Tokens.Escape).text, verbatim: true }];
      case "codespan":
        return [{ type: "code", text: (token as Tokens.Codespan).text }];
      case "strong":
        return [{ type: "strong", children: this.inlines((token as Tokens.Strong).tokens) }];
      case "em":
        return [{ type: "em", children: this.inlines((token as Tokens.Em).tokens) }];
      case "del":
        return [{ type: "del", children: this.inlines((token as Tokens.Del).tokens) }];
      case "br":
        return [{ type: "break" }];
      case "link": {
        const t = token as Tokens.Link;
        return [{ type: "link", href: t.href ?? "", children: this.inlines(t.tokens ?? []) }];
      }
      case "image": {
        const t = token as Tokens.Image;
        return [{ type: "image", href: t.href ?? "", alt: t.text }];
      }
      case "html":
      case "tag":
        return [{ type: "html", text: (token as Tokens.HTML | Tokens.Tag).text }];
      default:
        return [text((token as { text?: string }).text ?? "")];
    }
  }
}

function text(value: string): MdInline {
  return { type: "text", text: value };
}

function asAlign(value: string | null | undefined): Align {
  return value === "left" || value === "center" || value === "right" ? value : null;
}
