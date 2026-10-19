// `geek-book web [output-dir]` — build the website.
//
// The command owns the CLI surface (the usage line, the exit code) and hands the
// build to the `build-website` use case. A failure the use case returns is a
// diagnostic; the CLI prints it under the `geek-book: ` prefix it always has.

import path from "node:path";
import process from "node:process";
import { buildWebsite } from "../../application/usecases/build-website.js";
import type { Command } from "../context.js";

export const web: Command = {
  summary: "build the website (default: build/html)",
  run: async (ctx, args) => {
    if (args.length > 1) {
      process.stderr.write("usage: geek-book web [output-dir]\n");
      return 2;
    }
    const outputDir = args[0] ? path.resolve(args[0]) : ctx.settings.outputWeb;

    const result = await buildWebsite(ctx, outputDir);
    if (result.ok) {
      return 0;
    }
    for (const diagnostic of result.diagnostics) {
      process.stderr.write(`geek-book: ${diagnostic.message}\n`);
    }
    return 1;
  },
};
