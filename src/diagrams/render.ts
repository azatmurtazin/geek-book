// Build-time rendering of ```mermaid``` fences to inline SVG.
//
// Mermaid is a browser component, so this module shims a minimal DOM with
// jsdom before importing it, stubs the SVG measurement APIs jsdom does not
// implement (jsdom performs no layout), and rewrites the <foreignObject>
// labels mermaid emits into native SVG <text>, so the diagram renders the same
// inline on the web and as a PDF figure in the LaTeX build (rsvg-convert does
// not reliably draw <foreignObject> XHTML).
//
// The rendered <svg> is self-contained (geometry + labels), so website pages
// embed it inline with no client-side JavaScript, and the book build gets the
// identical diagram.

import { JSDOM } from "jsdom";

const FONT_FAMILY = "Literata, 'DejaVu Serif', serif";
const FONT_SIZE = 13;
const LABEL_FILL = "#202020";

// mermaid's default theme paints diagram nodes lavender (#ECECFF) with purple
// borders (#9370DB). Override its palette with the same greys the book's code
// blocks use, so diagrams sit quietly next to the prose.
const THEME_VARIABLES = {
  background: "#ffffff",
  primaryColor: "#f6f7f9",
  primaryBorderColor: "#8a93a1",
  primaryTextColor: "#20304c",
  secondaryColor: "#eef0f3",
  secondaryBorderColor: "#98a1ad",
  secondaryTextColor: "#20304c",
  tertiaryColor: "#e4e7ec",
  tertiaryBorderColor: "#98a1ad",
  tertiaryTextColor: "#20304c",
  lineColor: "#667085",
  edgeLabelBackground: "#ffffff",
  mainBkg: "#f6f7f9",
  nodeBorder: "#8a93a1",
  nodeTextColor: "#20304c",
  textColor: "#20304c",
  titleColor: "#20304c",
  noteBkgColor: "#f8fafc",
  noteBorderColor: "#cbd5e1",
  noteTextColor: "#333333",
  clusterBkg: "#ffffff",
  clusterBorder: "#e4e7ec",
  actorBkg: "#f6f7f9",
  actorBorder: "#8a93a1",
  actorTextColor: "#20304c",
  actorLineColor: "#667085",
  labelBoxBkgColor: "#ffffff",
  labelBoxBorderColor: "#98a1ad",
  labelTextColor: "#20304c",
  signalColor: "#667085",
  signalTextColor: "#20304c",
  activationBkgColor: "#eef0f3",
  activationBorderColor: "#8a93a1",
  sequenceNumberColor: "#20304c",
  loopTextColor: "#20304c",
  stateBkg: "#f6f7f9",
  stateBorder: "#8a93a1",
  stateLabelColor: "#20304c",
  stateEndColor: "#667085",
  innerEndBackground: "#667085",
  specialStateColor: "#667085",
  labelBackgroundColor: "#ffffff",
  compositeBackground: "#ffffff",
  compositeTitleBackground: "#eef0f3",
};

let mermaidPromise: Promise<typeof import("mermaid")> | null = null;

function setGlobal(key: string, value: unknown): void {
  (globalThis as unknown as Record<string, unknown>)[key] = value;
}

type Measurable = {
  querySelectorAll?: (selector: string) => unknown[];
  prototype: {
    getBBox?: () => unknown;
    getComputedTextLength?: () => unknown;
  };
};

function labelChars(el: unknown): number {
  let best = "";
  const meas = el as Measurable;
  const foreigns = meas.querySelectorAll?.("foreignObject") ?? [];
  for (const foreign of foreigns as { textContent?: string }[]) {
    const s = (foreign.textContent ?? "").replace(/\s+/g, " ").trim();
    if (s.length > best.length) best = s;
  }
  return best.length;
}

/** jsdom has no layout engine; size boxes from their label text. */
function shimMeasurement(windowObject: unknown): void {
  const proto = (windowObject as { SVGElement?: Measurable }).SVGElement?.prototype;
  if (!proto) return;
  proto.getBBox = function (this: unknown) {
    const chars = labelChars(this);
    const width = chars ? chars * 6.2 + 16 : 22;
    return { x: 0, y: 0, width, height: 24 };
  } as never;
  proto.getComputedTextLength = function (this: unknown) {
    return Math.max(10, labelChars(this) * 6.2);
  } as never;
  // mermaid sizes HTML labels through getBoundingClientRect, which jsdom
  // always reports as 0×0 — that makes flowchart edge labels come back as
  // translate(undefined, NaN). Return a text-sized box instead.
  const elementProto = (windowObject as { Element?: Measurable }).Element?.prototype as
    | { getBoundingClientRect?: unknown }
    | undefined;
  if (elementProto === undefined) return;
  elementProto.getBoundingClientRect = function (this: unknown) {
    const txt = ((this as { textContent?: string }).textContent ?? "")
      .replace(/\s+/g, " ")
      .trim();
    const width = txt.length > 0 ? Math.max(10, txt.length * 6.2 + 6) : 0;
    const height = txt.length > 0 ? 20 : 0;
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      width,
      height,
      toJSON: () => ({}),
    };
  } as never;
}

async function mermaid(): Promise<typeof import("mermaid")> {
  if (mermaidPromise === null) {
    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
      pretendToBeVisual: true,
    });
    // The DOM must exist before mermaid's dependencies (dompurify, d3) load,
    // so the module is imported dynamically, after the globals are installed.
    const win = dom.window as Record<string, unknown>;
    setGlobal("window", win);
    setGlobal("document", win.document);
    Object.defineProperty(globalThis, "navigator", {
      value: win.navigator,
      configurable: true,
    });
    setGlobal("XMLSerializer", win.XMLSerializer);
    if (win.CSSStyleSheet !== undefined) setGlobal("CSSStyleSheet", win.CSSStyleSheet);
    shimMeasurement(win);
    mermaidPromise = import("mermaid");
  }
  const mod = await mermaidPromise;
  mod.default.initialize({
    startOnLoad: false,
    theme: "default",
    securityLevel: "loose",
    fontFamily: FONT_FAMILY,
    themeVariables: { fontSize: `${FONT_SIZE}px`, fontFamily: FONT_FAMILY, ...THEME_VARIABLES },
    flowchart: { htmlLabels: true },
  });
  return mod;
}

/** Turn one <foreignObject> label into a centered native <text>. */
function foreignObjectToText(attrs: string, inner: string): string {
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
    `<text text-anchor="middle" font-family="${FONT_FAMILY}" font-size="${FONT_SIZE}" ` +
    `fill="${LABEL_FILL}">${tspans}</text>`
  );
}

/**
 * Standalone <svg> with mermaid's <foreignObject> labels as SVG <text>.
 */
export async function renderMermaid(source: string, id: string): Promise<string> {
  const mod = await mermaid();
  const { svg } = await mod.default.render(id, source);
  const start = svg.indexOf("<svg");
  const end = svg.lastIndexOf("</svg>");
  if (start < 0 || end < 0) throw new Error(`mermaid produced no <svg> for diagram ${id}`);
  let out = svg.slice(start, end + "</svg>".length);
  out = fixViewBox(out);
  out = out.replace(/<foreignObject([^>]*)>([\s\S]*?)<\/foreignObject>/g, (_, attrs: string, inner: string) =>
    foreignObjectToText(attrs, inner),
  );
  return out;
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
function fixViewBox(svg: string): string {
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

/**
 * Extract fenced ```mermaid blocks from a chapter. The fences become
 * placeholder paragraphs keyed by index; the diagram source stays available
 * for rendering. Markdown therefore never has to digest the SVG, and the SVG
 * is injected after `marked` has parsed the (placeholder) document.
 */
export async function preprocessMermaidMd(
  source: string,
): Promise<{ markdown: string; diagrams: Map<number, string> }> {
  const lines = source.split("\n");
  const out: string[] = [];
  const diagrams = new Map<number, string>();
  let index = 0;
  let i = 0;
  while (i < lines.length) {
    if (!/^```mermaid\s*$/.test(lines[i])) {
      out.push(lines[i]);
      i += 1;
      continue;
    }
    const body: string[] = [];
    i += 1;
    while (i < lines.length && !/^```\s*$/.test(lines[i])) {
      body.push(lines[i]);
      i += 1;
    }
    if (i >= lines.length) {
      // Unterminated fence: leave it for the linter to call out.
      out.push("```mermaid", ...body);
      break;
    }
    i += 1;
    index += 1;
    diagrams.set(index, body.join("\n"));
    out.push("", `::pe-diagram-${index}::`, "");
  }
  return { markdown: out.join("\n"), diagrams };
}

/** Swap the placeholder paragraphs for the rendered, inline <svg>. */
export function substituteDiagrams(bodyHtml: string, rendered: Map<number, string>): string {
  let out = bodyHtml;
  for (const [index, svg] of rendered) {
    const block = `<div class="diagram">\n${svg}\n</div>`;
    const marker = `<p>::pe-diagram-${index}::</p>`;
    if (out.includes(marker)) {
      out = out.replace(marker, block);
    } else {
      out = out.replace(`::pe-diagram-${index}::`, block);
    }
  }
  return out;
}
