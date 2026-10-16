// Build-time rendering of ```mermaid``` fences to inline SVG.
//
// Mermaid is a browser component, so a minimal DOM is shimmed with jsdom before
// importing it, the SVG measurement APIs jsdom does not implement are stubbed
// (jsdom performs no layout), and the <foreignObject> labels mermaid emits are
// rewritten into native SVG <text>, so the diagram renders the same inline on
// the web and as a PDF figure in the LaTeX build (rsvg-convert does not
// reliably draw <foreignObject> XHTML).
//
// The pieces live beside this file: `shims.ts` (the jsdom DOM and measurement
// stubs), `theme.ts` (the palette mapping) and `fixup.ts` (the viewBox and
// label rewriting). This module is the loader and the entry points.
//
// The rendered <svg> is self-contained (geometry + labels), so website pages
// embed it inline with no client-side JavaScript, and the book build gets the
// identical diagram.

import { diagramFamily } from "../lib/fonts.js";
import type { BookConfig } from "../lib/book-config.js";
import { FONT_SIZE, themeVariables } from "./theme.js";
import { installBrowserShims } from "./shims.js";
import { fixViewBox, foreignObjectToText } from "./fixup.js";

let mermaidPromise: Promise<typeof import("mermaid")> | null = null;

async function mermaid(cfg: BookConfig): Promise<typeof import("mermaid")> {
  if (mermaidPromise === null) {
    // The DOM must exist before mermaid's dependencies (dompurify, d3) load,
    // so the module is imported dynamically, after the globals are installed.
    installBrowserShims();
    mermaidPromise = import("mermaid");
  }
  const mod = await mermaidPromise;
  mod.default.initialize({
    startOnLoad: false,
    theme: "default",
    securityLevel: "loose",
    fontFamily: diagramFamily(cfg),
    themeVariables: { fontSize: `${FONT_SIZE}px`, fontFamily: diagramFamily(cfg), ...themeVariables(cfg) },
    flowchart: { htmlLabels: true },
  });
  return mod;
}

/**
 * Standalone <svg> with mermaid's <foreignObject> labels as SVG <text>.
 */
export async function renderMermaid(cfg: BookConfig, source: string, id: string): Promise<string> {
  const mod = await mermaid(cfg);
  const { svg } = await mod.default.render(id, source);
  const start = svg.indexOf("<svg");
  const end = svg.lastIndexOf("</svg>");
  if (start < 0 || end < 0) throw new Error(`mermaid produced no <svg> for diagram ${id}`);
  let out = svg.slice(start, end + "</svg>".length);
  out = fixViewBox(out);
  out = out.replace(/<foreignObject([^>]*)>([\s\S]*?)<\/foreignObject>/g, (_, attrs: string, inner: string) =>
    foreignObjectToText(cfg, attrs, inner),
  );
  return out;
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
    out.push("", `::gb-diagram-${index}::`, "");
  }
  return { markdown: out.join("\n"), diagrams };
}

/** Swap the placeholder paragraphs for the rendered, inline <svg>. */
export function substituteDiagrams(bodyHtml: string, rendered: Map<number, string>): string {
  let out = bodyHtml;
  for (const [index, svg] of rendered) {
    const block = `<div class="diagram">\n${svg}\n</div>`;
    const marker = `<p>::gb-diagram-${index}::</p>`;
    if (out.includes(marker)) {
      out = out.replace(marker, block);
    } else {
      out = out.replace(`::gb-diagram-${index}::`, block);
    }
  }
  return out;
}
