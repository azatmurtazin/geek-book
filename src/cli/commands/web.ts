// `geek-book web [dir]` — build the website.
//
// The command is thin: the orchestration lives in the build use case, which the
// web module provides while the refactor is in progress.

import type { Command } from "../context.js";

export const web: Command = {
  summary: "build the website (default: build/html)",
  run: async (ctx, args) => (await import("../../build-web-book/cli.js")).main(ctx.settings, args),
};
