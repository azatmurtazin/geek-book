// `geek-book pdf [file]` — build the printed book.

import type { Command } from "../context.js";

export const pdf: Command = {
  summary: "build the PDF (default: build/book.pdf)",
  run: async (ctx, args) => (await import("../../build-tex-book/cli.js")).main(ctx.settings, args),
};
