// `pdf-info`'s use case: hand a finished PDF to poppler and answer its report.
//
// The command names the file the reader typed; this resolves nothing about
// where it is — the CLI does that — and only checks that something is there,
// then asks the toolchain for what `pdfinfo` printed.

import { fail, type Result } from "../../domain/diagnostics.js";
import type { FileSystem } from "../ports/file-system.js";
import type { PdfToolchain } from "../ports/pdf-toolchain.js";

export interface PdfInfoDeps {
  readonly fs: FileSystem;
  readonly tools: PdfToolchain;
}

/** The `pdfinfo` report for `file`, or a diagnostic that says what went wrong. */
export function pdfInfo(deps: PdfInfoDeps, file: string): Result<string> {
  if (!deps.fs.exists(file)) {
    return fail({ severity: "error", code: "pdfinfo/no-file", message: `${file}: no such file` });
  }
  return deps.tools.info(file);
}
