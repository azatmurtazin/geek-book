// A picture in the tree (see ir.ts): its node, and where its file is.

import path from "node:path";
import type { Tokens } from "marked";
import { resolveImagePath } from "../lib/images.js";
import type { BookConfig } from "../lib/book-config.js";
import type { ImageNode, ImageRef } from "./ir.js";
import type { ParseState } from "./state.js";
import { decodeEntities } from "./entities.js";

/** A picture's node: the file it points at (or none), and its alt text. */
export function imageNode(cfg: BookConfig, token: Tokens.Image, state: ParseState): ImageNode {
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
export function placeImage(cfg: BookConfig, src: string, state: ParseState): ImageRef | null {
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
