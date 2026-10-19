// `geek-book pdf [output.pdf]` — build the printed book.
//
// The command owns the CLI surface and hands the build to the `build-pdf` use
// case. A failure the use case returns is a diagnostic; the CLI prints it under
// the `geek-book: ` prefix it always has.

import path from "node:path";
import process from "node:process";
import { buildPdf } from "../../application/usecases/build-pdf.js";
import type { Command } from "../context.js";

export const pdf: Command = {
  summary: "build the PDF (default: build/book.pdf)",
  run: async (ctx, args) => {
    if (args.length > 1) {
      process.stderr.write("usage: geek-book pdf [output.pdf]\n");
      return 2;
    }
    const outputPdf = args[0] ? path.resolve(args[0]) : ctx.settings.outputPdf;

    const result = await buildPdf(ctx, outputPdf);
    if (result.ok) {
      return 0;
    }
    for (const diagnostic of result.diagnostics) {
      process.stderr.write(`geek-book: ${diagnostic.message}\n`);
    }
    return 1;
  },
};
