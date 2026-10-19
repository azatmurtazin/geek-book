// `geek-book lint [family…]` — check the sources.
//
// The command owns the CLI surface the linter has always had: the family names,
// the `-v` flag, and which stream each kind of finding goes to. Warnings and
// notes are stdout, errors are stderr, and the summary goes wherever it will be
// read with them. The exit code is 1 when anything was an error.

import process from "node:process";
import { LINT_FAMILIES, type LintFamily } from "../../application/ports/lint-checks.js";
import { lintBook } from "../../application/usecases/lint-book.js";
import type { Command } from "../context.js";

function isFamily(value: string): value is LintFamily {
  return (LINT_FAMILIES as readonly string[]).includes(value);
}

export const lint: Command = {
  summary: "check the sources (summary, chapters, links, config)",
  run: (ctx, args) => {
    const verbose = args.includes("-v") || args.includes("--verbose");
    const selected = args.filter((arg) => !arg.startsWith("-"));
    const unknown = selected.filter((arg) => !isFamily(arg));
    if (unknown.length) {
      process.stderr.write(`lint: unknown check '${unknown[0]}' (choose from ${LINT_FAMILIES.join(", ")})\n`);
      return 2;
    }
    const families = new Set(selected.length ? selected.filter(isFamily) : LINT_FAMILIES);

    const report = lintBook(ctx, { families });

    for (const message of report.warnings) {
      process.stdout.write(`warning: ${message}\n`);
    }
    for (const message of report.errors) {
      process.stderr.write(`error: ${message}\n`);
    }

    // A note is expected while the book is being written, so notes are counted
    // by kind rather than listed; `-v` lists them too.
    if (report.notes.length) {
      const buckets = new Map<string, number>();
      for (const message of report.notes) {
        const idx = message.indexOf(": ");
        const kind = idx === -1 ? message : message.slice(0, idx);
        buckets.set(kind, (buckets.get(kind) ?? 0) + 1);
      }
      for (const kind of [...buckets.keys()].sort()) {
        process.stdout.write(`note: ${buckets.get(kind)} x ${kind}\n`);
      }
      if (verbose) {
        for (const message of report.notes) {
          process.stdout.write(`  ${message}\n`);
        }
      }
    }

    const summary = `\n${report.chapters} chapter file(s), ${report.errors.length} error(s), ${report.warnings.length} warning(s)`;
    if (report.errors.length) {
      process.stderr.write(`${summary}\n`);
    } else {
      process.stdout.write(`${summary}\n`);
    }
    return report.errors.length ? 1 : 0;
  },
};
