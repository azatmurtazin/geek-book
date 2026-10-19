// The PdfToolchain port: the three external tools a printed book needs.
//
// `compile` runs LuaLaTeX over a document, `svgToPdf` turns a rendered drawing
// into the figure LaTeX embeds, and `pageCount` reads how many pages came out.
// Each answers with a `Result`: a missing tool and a failed pass are failures,
// not exceptions. The adapter (`adapters/process/system-pdf-toolchain.ts`)
// knows the install paths and the compiler's pass dance; a test hands in a fake.

import type { Result } from "../../domain/diagnostics.js";

/** One LuaLaTeX pass: `draft` writes no PDF, `final` does. */
export type TexPass = "draft" | "final";

export interface PdfToolchain {
  /**
   * Compile `texDir`'s document (its `jobname.tex`) through `passes`, in order.
   * A failed pass returns the tail of the compiler log, where the error is.
   */
  compile(texDir: string, jobname: string, passes: readonly TexPass[]): Result<void>;
  /** Convert an SVG drawing to the PDF figure the printed edition embeds. */
  svgToPdf(svgFile: string, pdfFile: string): Result<void>;
  /** The page count of a finished PDF. */
  pageCount(pdfFile: string): Promise<Result<number>>;
}
