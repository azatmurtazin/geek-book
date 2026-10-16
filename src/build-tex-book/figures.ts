// Pictures on the page: the text block they are measured against, their size
// taken from their own pixels or viewBox, and the shrink-to-fit that keeps a
// large one inside the block without ever blowing a small one up.

import { imagePixels } from "../lib/image-size.js";
import { texEscape } from "./escape.js";
import type { BookConfig } from "../lib/book-config.js";
import type { Figure, ImageNode, ImageRef } from "./ir.js";

/**
 * The text block pictures are measured against: the paper less the configured
 * margins (see book-config.ts), the same geometry preamble.tex sets. A book
 * that changes its page changes what "fits" means with it.
 */
function textWidthMm(cfg: BookConfig) {
  return cfg.tex.geometry.textWidthMm;
}

function textHeightMm(cfg: BookConfig) {
  return cfg.tex.geometry.textHeightMm;
}

/** What a drawing with no viewBox is taken to measure, in the text block's terms. */
function unmeasuredFigureMm(cfg: BookConfig) {
  return { widthMm: textWidthMm(cfg), heightMm: 100 };
}

const pxToMm = (px: number): number => (px * 25.4) / 96;

/**
 * A drawing, placed at its own size unless it is bigger than the text block.
 *
 * The size comes from the SVG's viewBox, converted from its user units; a
 * drawing with no viewBox to measure is placed as a full-width figure, which is
 * what this builder assumed before it could measure one.
 */
export function figureTex(cfg: BookConfig, figure: Figure): string {
  const size = figure.size;
  const widthMm = size ? pxToMm(size.width) : unmeasuredFigureMm(cfg).widthMm;
  const heightMm = size ? pxToMm(size.height) : unmeasuredFigureMm(cfg).heightMm;
  const axis = shrinkAxis(cfg, widthMm, heightMm);
  const opts = axis === null ? "" : axis === "width" ? "[width=\\linewidth]" : "[height=\\textheight]";
  return `\\begin{center}\n\\includegraphics${opts}{figures/${figure.name}}\n\\end{center}`;
}

/**
 * Place a picture on the page.
 *
 * A picture prints at the size the web edition gives it — 96 pixels to the inch,
 * so the guide's 409-pixel bird is 108mm wide — and is scaled down to the text
 * block only when it would not fit, by width or by height, whichever binds
 * first. A picture smaller than the block is therefore never blown up to it:
 * stretching is what pixelates a small drawing, and the two editions then agree
 * on how large a picture is. A picture whose source has no file at all is its
 * alt text, which is also what the book's Markdown says.
 */
export function imageTex(cfg: BookConfig, node: ImageNode, centered: boolean): string {
  const ref = node.ref;
  if (ref === null) {
    return `\\textit{${texEscape(node.alt)}}`;
  }
  const body = `\\includegraphics${imageOptions(cfg, ref)}{figures/${ref.name}}`;
  return centered ? `\\begin{center}\n${body}\n\\end{center}` : body;
}

/**
 * The size options for one picture, given the file the build copied.
 *
 * The dimensions come from the file's own header (see lib/image-size.ts); a file
 * this cannot measure — a format it does not read, or one that is not there —
 * falls back to filling the block, which is how the builder placed every picture
 * before measurements existed.
 */
function imageOptions(cfg: BookConfig, ref: ImageRef): string {
  const pixels = imagePixels(ref.file);
  if (pixels === null) {
    return "[width=\\linewidth,height=\\textheight,keepaspectratio]";
  }
  const widthMm = pxToMm(pixels.width);
  const axis = shrinkAxis(cfg, widthMm, pxToMm(pixels.height));
  if (axis === null) {
    return `[width=${widthMm.toFixed(2)}mm]`;
  }
  return axis === "width" ? "[width=\\linewidth]" : "[height=\\textheight]";
}

/**
 * Which way a picture has to shrink to fit the text block, or `null` when it
 * already fits. Width wins a tie, as this builder has always decided.
 */
function shrinkAxis(cfg: BookConfig, widthMm: number, heightMm: number): "width" | "height" | null {
  if (widthMm <= textWidthMm(cfg) && heightMm <= textHeightMm(cfg)) {
    return null;
  }
  return widthMm / textWidthMm(cfg) >= heightMm / textHeightMm(cfg) ? "width" : "height";
}
