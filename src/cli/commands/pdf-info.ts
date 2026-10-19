// `geek-book pdf-info <pdf>` — print info about a PDF.

import type { Command } from "../context.js";

export const pdfInfo: Command = {
  summary: "print info about a PDF",
  run: async (_ctx, args) => (await import("../../pdf-info/cli.js")).main(args),
};
