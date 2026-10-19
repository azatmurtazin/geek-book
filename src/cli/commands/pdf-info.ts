// `geek-book pdf-info <pdf>` — print info about a PDF.

import path from "node:path";
import process from "node:process";
import { pdfInfo } from "../../application/usecases/pdf-info.js";
import type { Command } from "../context.js";

export const pdfInfoCommand: Command = {
  summary: "print info about a PDF",
  run: (ctx, args) => {
    if (args.length !== 1) {
      process.stderr.write("usage: geek-book pdf-info <input.pdf>\n");
      return 2;
    }
    const result = pdfInfo(ctx, path.resolve(args[0]));
    if (result.ok) {
      process.stdout.write(result.value.endsWith("\n") ? result.value : `${result.value}\n`);
      return 0;
    }
    const diagnostic = result.diagnostics[0];
    // The missing-file message names the file as the reader typed it.
    process.stderr.write(
      diagnostic.code === "pdfinfo/no-file" ? `geek-book: ${args[0]}: no such file\n` : `${diagnostic.message}\n`,
    );
    return 2;
  },
};
