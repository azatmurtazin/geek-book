// The system implementation of the PdfToolchain port: LuaLaTeX, rsvg-convert
// and poppler's pdfinfo, run through the ProcessRunner.
//
// Two pieces of system knowledge live here and nowhere else: the absolute paths
// a macOS install may keep off a non-login PATH (`TOOL_FALLBACKS`), and the
// shape of each tool's failure — a LaTeX error is in its log file, not on
// stderr, so a failed pass reads the log's tail.

import process from "node:process";
import path from "node:path";
import { fail, ok, type Result } from "../../domain/diagnostics.js";
import type { FileSystem } from "../../application/ports/file-system.js";
import type { PdfToolchain, TexPass } from "../../application/ports/pdf-toolchain.js";
import type { ProcessRunner } from "../../application/ports/process-runner.js";

/** Absolute locations for tools that macOS may not put on a non-login PATH. */
const TOOL_FALLBACKS: Record<string, readonly string[]> = {
  lualatex: ["/Library/TeX/texbin/lualatex", "/usr/local/texlive/bin/universal-darwin/lualatex"],
  "rsvg-convert": ["/usr/local/bin/rsvg-convert", "/opt/homebrew/bin/rsvg-convert"],
};

const PDFINFO = process.platform === "win32" ? "pdfinfo.exe" : "pdfinfo";

export class SystemPdfToolchain implements PdfToolchain {
  constructor(
    private readonly runner: ProcessRunner,
    private readonly fs: FileSystem,
  ) {}

  compile(texDir: string, jobname: string, passes: readonly TexPass[]): Result<void> {
    const logFile = path.join(texDir, `${jobname}.log`);
    for (const [index, pass] of passes.entries()) {
      const args = [
        "-interaction=nonstopmode",
        "-halt-on-error",
        "-file-line-error",
        `-jobname=${jobname}`,
        ...(pass === "final" ? [] : ["-draftmode"]),
        "book.tex",
      ];
      const failure = this.attempt("lualatex", args, { cwd: texDir, logFile });
      if (failure !== null) {
        return fail({
          severity: "error",
          code: "pdf/latex",
          message: `lualatex pass ${index + 1} failed:\n${failure}`,
        });
      }
    }
    return ok(undefined);
  }

  svgToPdf(svgFile: string, pdfFile: string): Result<void> {
    const failure = this.attempt("rsvg-convert", ["-f", "pdf", "-o", pdfFile, svgFile], {});
    if (failure !== null) {
      return fail({ severity: "error", code: "pdf/rsvg", message: `rsvg-convert failed for ${path.basename(pdfFile)}:\n${failure}` });
    }
    return ok(undefined);
  }

  async pageCount(pdfFile: string): Promise<Result<number>> {
    const run = this.runner.run(PDFINFO, [pdfFile]);
    if (run.kind === "missing") {
      return fail({
        severity: "error",
        code: "pdf/tool-missing",
        message: `${PDFINFO}: not found — install poppler (brew install poppler)`,
      });
    }
    if (run.kind === "failed") {
      const tail = run.stderr.trim().split("\n").slice(-3).join("\n");
      return fail({ severity: "error", code: "pdf/pdfinfo", message: `${PDFINFO} ${pdfFile} failed:\n${tail}` });
    }

    const match = /^Pages:\s*(\d+)\s*$/m.exec(run.stdout);
    const pages = match ? Number(match[1]) : NaN;
    if (!Number.isInteger(pages) || pages < 1) {
      return fail({
        severity: "error",
        code: "pdf/pdfinfo",
        message: `${PDFINFO}: cannot read a page count from:\n${run.stdout}`,
      });
    }
    return ok(pages);
  }

  /**
   * Run `command`, trying the known install paths after the bare name, and
   * answer the failure message — or `null` on success. When `logFile` names a
   * file the tool wrote, its tail is the message (an error LaTeX put in the log).
   */
  private attempt(
    command: string,
    args: readonly string[],
    options: { cwd?: string; logFile?: string },
  ): string | null {
    const attempts = [command, ...(TOOL_FALLBACKS[command] ?? [])];
    let lastMissing = command;
    for (const bin of attempts) {
      const result = this.runner.run(bin, args, { cwd: options.cwd });
      if (result.kind === "missing") {
        lastMissing = bin;
        continue;
      }
      if (result.kind === "ok") {
        return null;
      }
      if (options.logFile !== undefined) {
        const log = this.fs.readText(options.logFile);
        if (log !== null) {
          return tailOf(log);
        }
      }
      return result.message;
    }
    // The hint names the tool, not the last path tried: the original compared
    // the last *path*, so a missing lualatex suggested installing librsvg.
    return command === "lualatex"
      ? "lualatex: not found — install MacTeX or TeX Live"
      : `${lastMissing}: not found — install it (brew install librsvg)`;
  }
}

/** The last few non-empty lines of a file — enough of a LaTeX log to name the error. */
function tailOf(text: string): string {
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  return lines.slice(-25).join("\n");
}
