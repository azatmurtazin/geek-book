// Rewriting mermaid's raw SVG into what both editions can draw.
//
// A real viewBox — jsdom cannot measure, so it is recomputed from the emitted
// geometry — and native SVG <text> in place of the <foreignObject> labels that
// rsvg-convert will not reliably draw.

import { diagramFamily } from "../lib/fonts.js";
import type { BookConfig } from "../lib/book-config.js";
import { FONT_SIZE } from "./theme.js";

const LABEL_FILL = "#202020";

/** Turn one <foreignObject> label into a centered native <text>. */
export function foreignObjectToText(cfg: BookConfig, attrs: string, inner: string): string {
  const x = /x="(-?[\d.]+)"/.exec(attrs)?.[1] ?? "0";
  const y = /y="(-?[\d.]+)"/.exec(attrs)?.[1] ?? "0";
  const width = /width="([\d.]+)"/.exec(attrs)?.[1] ?? "0";
  const height = /height="([\d.]+)"/.exec(attrs)?.[1] ?? "0";
  const lines = inner
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<\/p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length === 0) return "";
  const cx = Number(x) + Number(width) / 2;
  const cy = Number(y) + Number(height) / 2;
  const lineHeight = FONT_SIZE * 1.05;
  const start = cy - ((lines.length - 1) * lineHeight) / 2;
  const tspans = lines
    .map(
      (line, i) =>
        `<tspan x="${cx.toFixed(1)}" dy="${i === 0 ? start.toFixed(1) : lineHeight}">${line
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")}</tspan>`,
    )
    .join("");
  return (
    `<text text-anchor="middle" font-family="${diagramFamily(cfg)}" font-size="${FONT_SIZE}" ` +
    `fill="${LABEL_FILL}">${tspans}</text>`
  );
}

type Box = { minX: number; minY: number; maxX: number; maxY: number };

function blankBox(): Box {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
}

/**
 * mermaid sizes its viewBox from `getBBox()`, which jsdom cannot do (no
 * layout). Recompute the content bounds from the geometry and translate
 * chains mermaid emitted, and rewrite the viewBox so the diagram scales and
 * crops correctly. Runs before the foreignObject rewrite so the label boxes
 * still carry width/height.
 */
export function fixViewBox(svg: string): string {
  const box = blankBox();
  const stack: Array<{ tx: number; ty: number }> = [{ tx: 0, ty: 0 }];
  const push = (x: number, y: number, w: number, h: number): void => {
    box.minX = Math.min(box.minX, x);
    box.minY = Math.min(box.minY, y);
    box.maxX = Math.max(box.maxX, x + w);
    box.maxY = Math.max(box.maxY, y + h);
  };
  const token =
    /<style[\s\S]*?<\/style>|<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)([^<>]*?)(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = token.exec(svg)) !== null) {
    if (m[1] === "/") {
      if (m[2] === "g" && stack.length > 1) stack.pop();
      continue;
    }
    const name = m[2];
    const attrs = m[3];
    const parent = stack[stack.length - 1];
    if (name === "g") {
      const tr = /translate\(\s*(-?[\d.e]+)[,\s]+(-?[\d.e]+)\s*\)/.exec(attrs);
      stack.push(
        tr
          ? { tx: parent.tx + Number(tr[1]), ty: parent.ty + Number(tr[2]) }
          : { tx: parent.tx, ty: parent.ty },
      );
    }
    if (name === "rect") {
      const x = num(attrs, "x");
      const y = num(attrs, "y");
      const w = num(attrs, "width");
      const h = num(attrs, "height");
      if (x !== null && y !== null && w !== null && h !== null) {
        push(parent.tx + x, parent.ty + y, w, h);
      }
    } else if (name === "circle" || name === "ellipse") {
      const cx = num(attrs, "cx");
      const cy = num(attrs, "cy");
      const r = num(attrs, name === "circle" ? "r" : "rx");
      if (cx !== null && cy !== null && r !== null) {
        push(parent.tx + cx - r, parent.ty + cy - r, 2 * r, 2 * r);
      }
    } else if (name === "foreignObject") {
      const x = num(attrs, "x") ?? 0;
      const y = num(attrs, "y") ?? 0;
      const w = num(attrs, "width") ?? 0;
      const h = num(attrs, "height") ?? 0;
      push(parent.tx + x, parent.ty + y, w, h);
    } else if (name === "path") {
      const numbers = (attrs.match(/-?\d+\.?\d*/g) ?? []).map(Number);
      for (let i = 0; i + 1 < numbers.length; i += 2) {
        push(numbers[i], numbers[i + 1], 0, 0);
      }
    }
  }
  if (!Number.isFinite(box.minX)) return svg;
  const pad = 16;
  const x = box.minX - pad;
  const y = box.minY - pad;
  const width = box.maxX - box.minX + 2 * pad;
  const height = box.maxY - box.minY + 2 * pad;
  const rounded = (v: number): string => `${Math.round(v * 10) / 10}`;
  return svg
    .replace(/ viewBox="[^"]*"/, ` viewBox="${rounded(x)} ${rounded(y)} ${rounded(width)} ${rounded(height)}"`)
    .replace(/style="max-width: [\d.]+px;?"/, `style="max-width: ${rounded(width)}px;"`);
}

function num(attrs: string, name: string): number | null {
  const re = new RegExp(`(?:^|\\s)${name}="(-?[\\d.e]+)"`);
  const hit = re.exec(attrs);
  return hit === null ? null : Number(hit[1]);
}
