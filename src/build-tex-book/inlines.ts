// A run of inline content: the tokens inside a paragraph, heading, cell or item.

import type { Token, Tokens } from "marked";
import type { BookConfig } from "../lib/book-config.js";
import type { Inline } from "./ir.js";
import type { ParseState } from "./state.js";
import { decodeEntities } from "./entities.js";
import { imageNode } from "./images.js";
import { linkTarget } from "./links.js";

/** A piece of literal text in the flow. */
export function text(value: string): Inline {
  return { kind: "text", text: value };
}

/** The inline content of a token list, in order. */
export function inlinesOf(cfg: BookConfig, tokens: Token[], state: ParseState): Inline[] {
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
