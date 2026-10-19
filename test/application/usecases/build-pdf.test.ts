// The printed build, driven against an in-memory disk with a stub toolchain and
// a stub LaTeX renderer: no LuaLaTeX, no rsvg-convert, no real PDF. The test
// checks the orchestration — the plan, the document it assembles, the passes it
// asks for and the page count it reports.

import { describe, expect, it } from "vitest";
import { FileConfigSource } from "../../../src/adapters/config/file-config-source.js";
import { NoRemoteImages } from "../../../src/adapters/http/remote-image-store.js";
import { MarkedParser } from "../../../src/adapters/markdown/marked-parser.js";
import { buildPdf } from "../../../src/application/usecases/build-pdf.js";
import type { LatexRenderer } from "../../../src/application/ports/latex-renderer.js";
import type { PdfToolchain, TexPass } from "../../../src/application/ports/pdf-toolchain.js";
import { loadSettings } from "../../../src/application/usecases/load-settings.js";
import { ok } from "../../../src/domain/diagnostics.js";
import { MemoryFileSystem } from "../../helpers/memory-fs.js";

const BOOK: Record<string, string> = {
  "/book/book.config.json": JSON.stringify({ title: "Test Book" }),
  "/book/book/SUMMARY.md": "# Summary\n\n- [One](01_one.md)\n- [Two](02_two.md)\n",
  "/book/book/01_one.md": "# One\n\nHello.\n",
  "/book/book/02_two.md": "# Two\n\nWorld.\n",
};

/** A toolchain that records the passes and answers a fixed page count. */
function fakeTools(record: TexPass[]): PdfToolchain {
  return {
    compile: (_dir, _jobname, passes) => {
      record.push(...passes);
      return ok(undefined);
    },
    svgToPdf: () => ok(undefined),
    pageCount: async () => ok(42),
    info: () => ok("Pages: 42\n"),
  };
}

const latex: LatexRenderer = {
  preamble: () => ok("% preamble"),
  frontMatter: () => "FRONT MATTER",
  chapter: () => "CHAPTER",
  groupHeading: (title) => `GROUP ${title}`,
};

describe("buildPdf", () => {
  it("assembles the document and runs three passes", async () => {
    const fs = new MemoryFileSystem(BOOK);
    const settings = loadSettings(new FileConfigSource(fs, "/book").read()).settings;
    const passes: TexPass[] = [];

    const result = await buildPdf(
      {
        settings,
        fs,
        latex,
        markdown: new MarkedParser(false),
        diagrams: { render: async (_source, _id, name) => ({ name, svg: "<svg/>", size: null }) },
        tools: fakeTools(passes),
        openImages: () => new NoRemoteImages(),
        logger: { info: () => {} },
      },
      "/book/out/book.pdf",
    );

    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toEqual({ chapters: 2, pages: 42, fetched: 0 });
    expect(passes).toEqual(["draft", "draft", "final"]);

    const tex = fs.readText("/book/out/book.tex") ?? "";
    expect(tex).toContain("% preamble");
    expect(tex).toContain("\\begin{document}");
    expect(tex).toContain("FRONT MATTER");
    expect(tex.match(/CHAPTER/g)).toHaveLength(2);
    expect(tex).toContain("\\end{document}");
  });

  it("stops before any chapter work when the book's preamble is missing", async () => {
    const fs = new MemoryFileSystem(BOOK);
    const settings = loadSettings(new FileConfigSource(fs, "/book").read()).settings;
    const broken: LatexRenderer = { ...latex, preamble: () => ({ ok: false, diagnostics: [{ severity: "error", code: "pdf/missing-preamble", message: "the tex.preamble file is missing: x.tex" }] }) };

    const result = await buildPdf(
      {
        settings,
        fs,
        latex: broken,
        markdown: new MarkedParser(false),
        diagrams: { render: async (_source, _id, name) => ({ name, svg: "<svg/>", size: null }) },
        tools: fakeTools([]),
        openImages: () => new NoRemoteImages(),
        logger: { info: () => {} },
      },
      "/book/out/book.pdf",
    );

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.diagnostics[0].message).toBe("the tex.preamble file is missing: x.tex");
    expect(fs.exists("/book/out/book.tex")).toBe(false);
  });
});
