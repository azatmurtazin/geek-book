// The diagram pipeline: a ```mermaid``` fence drawn once and placed in both
// editions. This is the one suite that boots jsdom and Mermaid (see
// `src/diagrams/shims.ts`), so it lives in its own file — the shims install
// global browser APIs that must not leak into the pure suites (render, parse,
// lint), and keeping the two apart is what makes the leak impossible.
//
// Assertions are structural, not byte-exact: an `<svg>` with a `viewBox`, its
// labels rewritten from `<foreignObject>` into native SVG `<text>`, and one
// registered figure with a size. A Mermaid upgrade should read as a version
// change, not a broken golden — the byte-exact guard for the editions is
// `just verify` over the whole guide, which builds the real diagram chapter.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderMermaid } from "../../src/diagrams/render.js";
import { extractDiagrams } from "../../src/domain/services/extract-diagrams.js";
import { renderSourceToHtml } from "../../src/md-to-html/render.js";
import { parseChapter } from "../../src/build-tex-book/parse.js";
import { chapterTex } from "../../src/adapters/render-tex/tex.js";
import { fixtureConfig } from "../helpers/config.js";
import { chapterContext } from "../helpers/chapter.js";

const cfg = fixtureConfig();
const here = path.dirname(fileURLToPath(import.meta.url));
const diagramMd = fs.readFileSync(path.resolve(here, "..", "fixtures", "golden", "diagram.md"), "utf8");

const SOURCE = "flowchart LR\n  a[Alpha] --> b[Beta]";

describe("renderMermaid — one self-contained drawing", () => {
  it("returns a standalone <svg> with a recomputed viewBox", async () => {
    const svg = await renderMermaid(cfg, SOURCE, "test-dgm");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).toContain("viewBox=");
  });

  it("rewrites every <foreignObject> label into native SVG <text>", async () => {
    const svg = await renderMermaid(cfg, SOURCE, "test-dgm-text");
    expect(svg).not.toContain("<foreignObject");
    expect(svg).toMatch(/<text\b/);
    expect(svg).toContain("Alpha");
  });
});

describe("extractDiagrams — the fence never reaches the Markdown parser", () => {
  it("swaps a fence for a placeholder paragraph and keeps its source", () => {
    const { markdown, diagrams } = extractDiagrams(
      "before\n\n```mermaid\nflowchart LR\n```\n\nafter",
    );
    expect(diagrams.get(1)).toBe("flowchart LR");
    expect(markdown).toContain("::gb-diagram-1::");
    expect(markdown).not.toContain("mermaid");
  });
});

describe("the golden diagram — one source, both editions", () => {
  it("embeds an inline <svg> in the website body", async () => {
    const html = await renderSourceToHtml(cfg, diagramMd);
    expect(html).toContain('<div class="diagram">');
    expect(html).toContain("<svg");
    expect(html).toContain("Alpha");
  });

  it("registers one sized figure for the printed edition", async () => {
    const chapter = await parseChapter(cfg, diagramMd, chapterContext());
    expect(chapter.figures).toHaveLength(1);
    const figure = chapter.figures[0];
    expect(figure.name).toBe("c3-d1.pdf");
    expect(figure.svg.startsWith("<svg")).toBe(true);
    expect(figure.size).not.toBeNull();
    expect(figure.size!.width).toBeGreaterThan(0);
    expect(figure.size!.height).toBeGreaterThan(0);
  });

  it("places that figure in the LaTeX", async () => {
    const chapter = await parseChapter(cfg, diagramMd, chapterContext());
    const tex = chapterTex(cfg, chapter);
    expect(tex).toContain("\\includegraphics");
    expect(tex).toContain("figures/c3-d1.pdf");
  });
});
