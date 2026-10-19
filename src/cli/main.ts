// The geek-book composition root.
//
// The one place the whole object graph is assembled: the config is read through
// the `ConfigSource` adapter and turned into settings by the pure loader, and an
// adapter is built for each port a command may reach. Commands are thin — they
// parse their own args and hand numbers back — so this file owns the CLI
// surface: which commands exist, what `--config` means, and what an exit code
// says.
//
//   geek-book web [dir]        build the website (default: build/html)
//   geek-book pdf [file]       build the PDF     (default: build/book.pdf)
//   geek-book serve [dir] [p]  preview the built website
//   geek-book lint [family…]   check the sources (summary, chapters, links, config)
//   geek-book md <in> [out]    render one Markdown file on its own
//   geek-book pdf-info <pdf>   page count, page size and friends
//   geek-book config           print the resolved book configuration
//
// `--config <file>` may sit anywhere on the line. The book is then the one
// beside that config file rather than the directory the CLI runs from, so a
// checkout can build another book without changing directory.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { FileConfigSource } from "../adapters/config/file-config-source.js";
import { NodeFileSystem } from "../adapters/fs/node-file-system.js";
import { ConsoleLogger } from "../adapters/reporting/console-logger.js";
import { ConsoleReporter } from "../adapters/reporting/console-reporter.js";
import { takeConfigOption } from "../application/settings/config-option.js";
import { loadSettings } from "../application/usecases/load-settings.js";
import { COMMANDS } from "./commands/index.js";
import type { AppContext } from "./context.js";
import { composeContext } from "./context.js";
import type { Logger } from "../application/ports/logger.js";

/** The help text: what the CLI is, and the subcommands it knows. */
function usage(ctx: AppContext, logger: Logger): void {
  const width = Math.max(...Object.keys(COMMANDS).map((name) => name.length));
  const lines = [
    `geek-book — build "${ctx.settings.title}" (${ctx.settings.root})`,
    "",
    "usage: geek-book <command> [args]",
    "",
    ...Object.entries(COMMANDS).map(([name, cmd]) => `  ${name.padEnd(width)}  ${cmd.summary}`),
    "",
    "The book is the directory geek-book runs from: it reads book.config.json and",
    "the sources under book/, then writes the website and the print PDF.",
    "",
    "`--config <file>` builds the book beside another config file instead.",
  ];
  for (const line of lines) logger.info(line);
}

/** Parse the line, assemble the context, and run the chosen command. */
export async function main(argv: string[]): Promise<number> {
  const option = takeConfigOption(argv);

  // The CLI is where diagnostics become text and an exit code is chosen.
  const reporter = new ConsoleReporter(process.stdout, process.stderr);
  // Build progress goes to stdout; the CLI's own usage/help text is stderr (as
  // it always has been).
  const logger = new ConsoleLogger(process.stdout);
  const usageLogger = new ConsoleLogger(process.stderr);

  const io = new NodeFileSystem();
  const loaded = loadSettings(new FileConfigSource(io, process.cwd(), option.file).read());
  for (const diagnostic of loaded.diagnostics) reporter.report(diagnostic);

  const ctx: AppContext = composeContext(loaded.settings, reporter, logger, io);

  if (option.missingValue) {
    reporter.report({
      severity: "error",
      code: "cli/config-missing-value",
      message: "--config needs a file",
    });
    usageLogger.info("");
    usage(ctx, usageLogger);
    return 2;
  }
  if (option.file) {
    const file = path.resolve(process.cwd(), option.file);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      reporter.report({
        severity: "error",
        code: "cli/config-not-found",
        message: `no such config file: ${option.file}`,
      });
      return 2;
    }
  }

  const [command, ...args] = option.argv;
  if (!command || command === "help" || command === "--help" || command === "-h") {
    usage(ctx, usageLogger);
    return command ? 0 : 2;
  }
  const chosen = COMMANDS[command];
  if (!chosen) {
    reporter.report({
      severity: "error",
      code: "cli/unknown-command",
      message: `unknown command '${command}'`,
    });
    usageLogger.info("");
    usage(ctx, usageLogger);
    return 2;
  }
  return chosen.run(ctx, args);
}

process.exitCode = await main(process.argv.slice(2));
