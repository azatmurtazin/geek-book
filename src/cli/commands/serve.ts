// `geek-book serve [dir] [port] [--watch]` — preview the built website.
//
// The command parses the loose positional surface the command has always had
// (a number is the port, anything else is the directory) and hands the rest to
// the `serve-site` use case. With `--watch`, `watch-site` builds the website
// first and rebuilds it when a source is saved. A missing directory, an invalid
// port or an occupied port is printed as one `serve: ` line, with exit code 1;
// a build failure keeps the `geek-book: ` prefix the build commands use.

import process from "node:process";
import { buildWebsite } from "../../application/usecases/build-website.js";
import { serveSite } from "../../application/usecases/serve-site.js";
import { watchSite } from "../../application/usecases/watch-site.js";
import type { Command } from "../context.js";

export const serve: Command = {
  summary: "preview the built website (--watch rebuilds it on changes)",
  run: async (ctx, args) => {
    let dir: string | undefined;
    let port: number | undefined;
    let watch = false;
    for (const arg of args) {
      if (arg === "--watch") {
        watch = true;
      } else if (/^\d+$/.test(arg)) {
        port = Number(arg);
      } else if (arg.startsWith("-")) {
        process.stderr.write("usage: geek-book serve [dir] [port] [--watch]\n");
        return 2;
      } else {
        dir = arg;
      }
    }

    const result = watch
      ? await watchSite(
          {
            settings: ctx.settings,
            fs: ctx.fs,
            server: ctx.server,
            logger: ctx.logger,
            reporter: ctx.reporter,
            watcher: ctx.watcher,
            build: (outputDir) => buildWebsite(ctx, outputDir),
          },
          { dir, port },
        )
      : await serveSite(ctx, { dir, port });

    if (result.ok) {
      return 0;
    }
    for (const diagnostic of result.diagnostics) {
      const prefix = diagnostic.code.startsWith("serve/") ? "" : "geek-book: ";
      process.stderr.write(`${prefix}${diagnostic.message}\n`);
    }
    return 1;
  },
};
