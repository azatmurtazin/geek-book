// `geek-book lint [family…]` — check the sources.

import type { Command } from "../context.js";

export const lint: Command = {
  summary: "check the sources (summary, chapters, links, config)",
  run: async (ctx, args) => (await import("../../adapters/lint/cli.js")).main(ctx.settings, args),
};
