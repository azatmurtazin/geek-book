// The console implementation of the Reporter port.
//
// Format is the one the engine already prints, so swapping a direct
// `console.error("error: …")` for `reporter.report(…)` changes no line:
//
//   error: chapters/01.md:4: a link points nowhere
//   warning: book/SUMMARY.md: a chapter is not listed
//   note: 1 x remote image, fetched at build time
//
// Errors go to the error stream; warnings and notes to the other one. Both
// streams are injected, so a test — or a future non-console front end — can
// supply its own.

import type { Diagnostic, Locus } from "../../domain/diagnostics.js";
import type { Reporter } from "../../application/ports/reporter.js";

/** The little of a writable stream the reporter needs. */
export interface Writable {
  write(chunk: string): unknown;
}

/** `file:line: ` (or `file: ` when there is no line), or nothing without a locus. */
function where(locus: Locus | undefined): string {
  if (locus === undefined) return "";
  return locus.line === undefined ? `${locus.file}: ` : `${locus.file}:${locus.line}: `;
}

/** One diagnostic as the single line the console shows. */
export function formatDiagnostic(diagnostic: Diagnostic): string {
  return `${diagnostic.severity}: ${where(diagnostic.locus)}${diagnostic.message}`;
}

export class ConsoleReporter implements Reporter {
  constructor(
    private readonly out: Writable,
    private readonly err: Writable,
  ) {}

  report(diagnostic: Diagnostic): void {
    const stream = diagnostic.severity === "error" ? this.err : this.out;
    stream.write(`${formatDiagnostic(diagnostic)}\n`);
  }
}
