// Print info about a PDF file: page count, page size, producer, dates, and
// more, via poppler's pdfinfo.
//
// Usage: geek-book pdf-info <input.pdf>

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

function usage(): void {
  process.stderr.write("usage: geek-book pdf-info <input.pdf>\n");
}

const PDFINFO = process.platform === "win32" ? "pdfinfo.exe" : "pdfinfo";

export function main(args: string[]): number {
  if (args.length !== 1) {
    usage();
    return 2;
  }
  const inputArg = args[0];

  const input = path.resolve(inputArg);
  if (!fs.existsSync(input)) {
    process.stderr.write(`geek-book: ${inputArg}: no such file\n`);
    return 2;
  }

  const result = spawnSync(PDFINFO, [inputArg], { stdio: "inherit" });

  if (result.error && (result.error as NodeJS.ErrnoException).code === "ENOENT") {
    process.stderr.write(`${PDFINFO}: not found — install poppler (brew install poppler)\n`);
    return 2;
  }
  if (result.status !== 0) {
    return result.status ?? 1;
  }
  return 0;
}
