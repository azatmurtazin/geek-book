// The printed edition's preamble (see src/build-tex-book/preamble.ts): the
// built-in LaTeX with its `<< … >>` placeholders filled from the book config,
// then a book's own preamble appended. The fixture book stands in for a real
// one; a couple of variants show that the `tex` block and the language reach
// the LaTeX.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { preambleTex } from "../../src/build-tex-book/preamble.js";
import type { BookConfig } from "../../src/lib/book-config.js";
import { fixtureConfig } from "../helpers/config.js";

const cfg = fixtureConfig();

describe("preambleTex — the book's own values", () => {
  const tex = preambleTex(cfg);

  it("leaves no placeholder unfilled", () => {
    expect(tex).not.toMatch(/<<[^>]*>>/);
  });

  it("names the document class, size, paper and side", () => {
    expect(tex).toContain("\\documentclass[11pt,a4paper,oneside]{book}");
  });

  it("sets the page geometry from the margins", () => {
    expect(tex).toContain("\\usepackage[top=19mm,bottom=19mm,left=18mm,right=18mm]{geometry}");
  });

  it("sets the text and code families, with a bold face only when named", () => {
    expect(tex).toContain("\\setmainfont{Literata}[BoldFont={Literata:mode=harf;wght=700}]");
    expect(tex).toContain("\\setmonofont{JetBrains Mono}");
  });

  it("defines the palette, with the capitals the heading code needs", () => {
    expect(tex).toContain("\\definecolor{fg}{HTML}{242a37}");
    expect(tex).toContain("\\definecolor{codebg}{HTML}{f6f7f9}");
    expect(tex).toContain("\\definecolor{RULE}{HTML}{e4e7ec}");
    expect(tex).toContain("\\definecolor{CODEBG}{HTML}{f6f7f9}");
  });

  it("takes the type scale, leading included", () => {
    expect(tex).toContain("\\fontsize{20}{24}\\selectfont");
    expect(tex).toContain("\\fontsize{15}{18}\\selectfont");
  });

  it("prints the escaped book title in the running head", () => {
    expect(tex).toContain("Fixture Book");
  });

  it("sets the TOC depth and names the contents page", () => {
    expect(tex).toContain("\\setcounter{tocdepth}{0}");
    expect(tex).toContain("\\renewcommand{\\contentsname}{Table of Contents}");
  });

  it("loads no babel for English", () => {
    expect(tex).not.toContain("babel");
  });
});

describe("preambleTex — the book's choices", () => {
  it("reads the tex block for class, side and TOC depth", () => {
    const book: BookConfig = { ...cfg, tex: { ...cfg.tex, class: "report", side: "twoside", tocDepth: 2 } };
    const tex = preambleTex(book);
    expect(tex).toContain("\\documentclass[11pt,a4paper,twoside]{report}");
    expect(tex).toContain("\\setcounter{tocdepth}{2}");
  });

  it("recolours the palette", () => {
    const book: BookConfig = { ...cfg, tex: { ...cfg.tex, colors: { ...cfg.tex.colors, fg: "#112233" } } };
    expect(preambleTex(book)).toContain("\\definecolor{fg}{HTML}{112233}");
  });

  it("loads babel for a recognised language, primary subtag only", () => {
    expect(preambleTex({ ...cfg, language: "de-DE" })).toContain("\\usepackage[ngerman]{babel}");
  });

  it("leaves a language it does not know to LaTeX's default", () => {
    expect(preambleTex({ ...cfg, language: "xx" })).not.toContain("babel");
  });

  it("appends a book's own preamble after the built-in one", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "geek-book-test-"));
    const file = path.join(dir, "extra.tex");
    fs.writeFileSync(file, "\\usepackage{foo}\n");
    const book: BookConfig = { ...cfg, tex: { ...cfg.tex, preamble: file } };
    expect(preambleTex(book)).toMatch(/\\usepackage\{foo\}$/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("names the file when a book's tex.preamble is missing", () => {
    const book: BookConfig = { ...cfg, tex: { ...cfg.tex, preamble: path.join(os.tmpdir(), "nope.tex") } };
    expect(() => preambleTex(book)).toThrow(/tex\.preamble file is missing/);
  });
});
