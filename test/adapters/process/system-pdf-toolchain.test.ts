// The system PdfToolchain over a fake ProcessRunner and an in-memory file
// system: the pass dance, the log tail, the fallback paths and the page count,
// none of which touches a real compiler.

import path from "node:path";
import { describe, expect, it } from "vitest";
import { SystemPdfToolchain } from "../../../src/adapters/process/system-pdf-toolchain.js";
import type { ProcessResult, ProcessRunner } from "../../../src/application/ports/process-runner.js";
import { MemoryFileSystem } from "../../helpers/memory-fs.js";

type Handler = (command: string, args: readonly string[]) => ProcessResult;

function runner(handler: Handler): ProcessRunner {
  return { run: (command, args) => handler(command, args) };
}

const ok: ProcessResult = { kind: "ok", stdout: "", stderr: "" };

describe("SystemPdfToolchain — compile", () => {
  it("runs the requested passes, draft first, final without -draftmode", () => {
    const calls: string[][] = [];
    const tools = new SystemPdfToolchain(
      runner((_command, args) => {
        calls.push([...args]);
        return ok;
      }),
      new MemoryFileSystem(),
    );

    const result = tools.compile("/tmp/build", "book", ["draft", "draft", "final"]);
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(3);
    expect(calls[0]).toContain("-draftmode");
    expect(calls[2]).not.toContain("-draftmode");
    expect(calls[0]).toContain("-jobname=book");
  });

  it("reports a failed pass with the tail of the compiler log", () => {
    const fs = new MemoryFileSystem({
      [path.join("/tmp/build", "book.log")]: "line one\n\n! Undefined control sequence.\n",
    });
    const tools = new SystemPdfToolchain(
      runner(() => ({ kind: "failed", message: "boom", stdout: "", stderr: "" })),
      fs,
    );

    const result = tools.compile("/tmp/build", "book", ["draft"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics[0].code).toBe("pdf/latex");
      expect(result.diagnostics[0].message).toContain("lualatex pass 1 failed:");
      expect(result.diagnostics[0].message).toContain("! Undefined control sequence.");
    }
  });

  it("names an install hint when the compiler is missing everywhere", () => {
    const tools = new SystemPdfToolchain(
      runner(() => ({ kind: "missing", tool: "lualatex" })),
      new MemoryFileSystem(),
    );
    const result = tools.compile("/tmp/build", "book", ["draft"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics[0].message).toContain("install MacTeX or TeX Live");
    }
  });
});

describe("SystemPdfToolchain — svgToPdf", () => {
  it("passes the drawing and the figure name to rsvg-convert", () => {
    let seen: readonly string[] = [];
    const tools = new SystemPdfToolchain(
      runner((_command, args) => {
        seen = args;
        return ok;
      }),
      new MemoryFileSystem(),
    );

    expect(tools.svgToPdf("/f/c1-d0.svg", "/f/c1-d0.pdf").ok).toBe(true);
    expect(seen).toEqual(["-f", "pdf", "-o", "/f/c1-d0.pdf", "/f/c1-d0.svg"]);
  });

  it("names an install hint when rsvg-convert is missing", () => {
    const tools = new SystemPdfToolchain(
      runner(() => ({ kind: "missing", tool: "rsvg-convert" })),
      new MemoryFileSystem(),
    );
    const result = tools.svgToPdf("/f/a.svg", "/f/a.pdf");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics[0].message).toContain("brew install librsvg");
    }
  });
});

describe("SystemPdfToolchain — pageCount", () => {
  const tools = (handler: Handler) => new SystemPdfToolchain(runner(handler), new MemoryFileSystem());

  it("reads the page count pdfinfo reports", async () => {
    const result = await tools(() => ({ kind: "ok", stdout: "Pages:          37\n", stderr: "" })).pageCount("/f/book.pdf");
    expect(result).toEqual({ ok: true, value: 37 });
  });

  it("reports a missing pdfinfo with an install hint", async () => {
    const result = await tools(() => ({ kind: "missing", tool: "pdfinfo" })).pageCount("/f/book.pdf");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics[0].message).toContain("install poppler");
    }
  });

  it("reports output it cannot read as a page count", async () => {
    const result = await tools(() => ({ kind: "ok", stdout: "no pages here\n", stderr: "" })).pageCount("/f/book.pdf");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics[0].message).toContain("cannot read a page count");
    }
  });
});
