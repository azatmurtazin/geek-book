// Read a finished PDF's page count with poppler's pdfinfo. Used by the LaTeX
// book build to report how many pages it produced.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const PDFINFO = process.platform === "win32" ? "pdfinfo.exe" : "pdfinfo";

function pagesOf(info: string): number {
  const match = /^Pages:\s*(\d+)\s*$/m.exec(info);
  const pages = match ? Number(match[1]) : NaN;
  if (!Number.isInteger(pages) || pages < 1) {
    throw new Error(`pdfinfo: cannot read a page count from:\n${info}`);
  }
  return pages;
}

/** Page count of a finished PDF, via poppler's pdfinfo. */
export async function pdfPages(pdfFile: string): Promise<number> {
  let stdout: string;
  try {
    ({ stdout } = await execFileP(PDFINFO, [pdfFile]));
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { stderr?: string };
    if (err.code === "ENOENT") {
      throw new Error(`${PDFINFO}: not found — install poppler (brew install poppler)`);
    }
    const tail = (err.stderr ?? "").trim().split("\n").slice(-3).join("\n");
    throw new Error(`${PDFINFO} ${pdfFile} failed:\n${tail}`);
  }
  return pagesOf(stdout);
}
