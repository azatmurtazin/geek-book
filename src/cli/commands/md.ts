// `geek-book md <in> [out]` — render one Markdown file on its own.

import type { Command } from "../context.js";

export const md: Command = {
  summary: "render one Markdown file to a standalone HTML page",
  run: async (ctx, args) => (await import("../../md-to-html/cli.js")).main(ctx.settings, args),
};
