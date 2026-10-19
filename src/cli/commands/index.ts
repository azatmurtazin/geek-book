// The subcommands, in the order the help text lists them.

import type { Command } from "../context.js";
import { config } from "./config.js";
import { lint } from "./lint.js";
import { md } from "./md.js";
import { pdf } from "./pdf.js";
import { pdfInfoCommand } from "./pdf-info.js";
import { serve } from "./serve.js";
import { web } from "./web.js";

export const COMMANDS: Record<string, Command> = {
  web,
  pdf,
  serve,
  lint,
  md,
  "pdf-info": pdfInfoCommand,
  config,
};
