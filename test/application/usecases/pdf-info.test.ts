// `pdf-info`'s use case: the one failure it owns (no such file) and the report
// it passes through from the toolchain.

import { describe, expect, it } from "vitest";
import type { PdfToolchain } from "../../../src/application/ports/pdf-toolchain.js";
import { pdfInfo } from "../../../src/application/usecases/pdf-info.js";
import { fail, ok } from "../../../src/domain/diagnostics.js";
import { MemoryFileSystem } from "../../helpers/memory-fs.js";

/** A toolchain that records what it was asked for and answers with `report`. */
function tools(report: ReturnType<typeof ok<string>> | ReturnType<typeof fail>) {
  const asked: string[] = [];
  const toolchain: PdfToolchain = {
    compile: () => ok(undefined),
    svgToPdf: () => ok(undefined),
    pageCount: async () => ok(0),
    info: (file) => {
      asked.push(file);
      return report;
    },
  };
  return { asked, toolchain };
}

describe("pdfInfo", () => {
  it("answers with the toolchain's report for an existing file", () => {
    const { asked, toolchain } = tools(ok("Pages: 39"));
    const fs = new MemoryFileSystem({ "/book/book.pdf": "%PDF" });

    const result = pdfInfo({ fs, tools: toolchain }, "/book/book.pdf");

    expect(result).toEqual(ok("Pages: 39"));
    expect(asked).toEqual(["/book/book.pdf"]);
  });

  it("fails without asking the toolchain when the file is not there", () => {
    const { asked, toolchain } = tools(ok("Pages: 39"));
    const fs = new MemoryFileSystem();

    const result = pdfInfo({ fs, tools: toolchain }, "/book/gone.pdf");

    expect(result).toEqual(
      fail({
        severity: "error",
        code: "pdfinfo/no-file",
        message: "/book/gone.pdf: no such file",
      }),
    );
    expect(asked).toEqual([]);
  });

  it("passes a toolchain failure through unchanged", () => {
    const diagnostic = fail({
      severity: "error",
      code: "pdfinfo/failed",
      message: "pdfinfo: not installed",
    });
    const { toolchain } = tools(diagnostic);
    const fs = new MemoryFileSystem({ "/book/book.pdf": "%PDF" });

    expect(pdfInfo({ fs, tools: toolchain }, "/book/book.pdf")).toEqual(diagnostic);
  });
});
