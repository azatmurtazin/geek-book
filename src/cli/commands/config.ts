// `geek-book config` — print the resolved book configuration.

import process from "node:process";
import { showConfig } from "../../application/usecases/show-config.js";
import type { Command } from "../context.js";

export const config: Command = {
  summary: "print the resolved book configuration",
  run: (ctx) => {
    process.stdout.write(`${showConfig(ctx.settings)}\n`);
    return 0;
  },
};
