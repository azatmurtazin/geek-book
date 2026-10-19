// `geek-book serve [dir] [port]` — preview the built website.
//
// The command parses the loose positional surface the command has always had
// (a number is the port, anything else is the directory) and hands the rest to
// the `serve-site` use case. The one failure — a directory that is not there —
// is printed as the `serve: ` line it always was, with exit code 1.

import process from "node:process";
import { serveSite } from "../../application/usecases/serve-site.js";
import type { Command } from "../context.js";

export const serve: Command = {
  summary: "preview the built website",
  run: (ctx, args) => {
    let dir: string | undefined;
    let port: number | undefined;
    for (const arg of args) {
      if (/^\d+$/.test(arg)) {
        port = Number(arg);
      } else {
        dir = arg;
      }
    }

    const result = serveSite(ctx, { dir, port });
    if (result.ok) {
      return 0;
    }
    process.stderr.write(`${result.diagnostics[0].message}\n`);
    return 1;
  },
};
