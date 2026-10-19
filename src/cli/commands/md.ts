// `geek-book md <input.md> [output.html]` — render one Markdown file on its own.
//
// The command owns the CLI surface — the usage line, the default output name
// and the `geek-book: in -> out` line — and hands the render to the
// `render-standalone` use case. A source the renderer cannot draw is printed
// under the `geek-book: ` prefix instead of crashing the process.

import path from "node:path";
import process from "node:process";
import { renderStandalone } from "../../application/usecases/render-standalone.js";
import type { Command } from "../context.js";

export const md: Command = {
  summary: "render one Markdown file to a standalone HTML page",
  run: async (ctx, args) => {
    if (args.length < 1 || args.length > 2) {
      process.stderr.write("usage: geek-book md <input.md> [output.html]\n");
      return 2;
    }
    const [inputArg, outputArg] = args;
    const input = path.resolve(inputArg);
    const output = outputArg ? path.resolve(outputArg) : input.replace(/\.md$/i, ".html");

    const result = await renderStandalone(ctx, input, output);
    if (result.ok) {
      process.stdout.write(
        `geek-book: ${path.relative(process.cwd(), input)} -> ${path.relative(process.cwd(), output)}\n`,
      );
      return 0;
    }
    const diagnostic = result.diagnostics[0];
    process.stderr.write(
      diagnostic.code === "md/no-file" ? `geek-book: ${inputArg}: no such file\n` : `geek-book: ${diagnostic.message}\n`,
    );
    return 2;
  },
};
