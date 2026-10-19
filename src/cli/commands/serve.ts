// `geek-book serve [dir] [port]` — preview the built website.

import type { Command } from "../context.js";

export const serve: Command = {
  summary: "preview the built website",
  run: async (ctx, args) => (await import("../../serve/cli.js")).main(ctx.settings, args),
};
