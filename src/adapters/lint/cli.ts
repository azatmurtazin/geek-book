// Structural checks for the book sources.
//
// Run with `npm run lint` (or `just lint`) for every family at once, or one
// family at a time with `npm run lint-summary`, `lint-chapters`, `lint-links`
// or `lint-config`. Exits non-zero when something is wrong with the content or
// the chapter tree; style nits that are advisory are reported as warnings and
// do not fail the build.
//
// A TypeScript port of the original scripts/lint.py — behaviour and messages
// are unchanged.
//
// Checks, by family
//   summary   1. every chapter file on disk is listed in SUMMARY.md
//             2. every SUMMARY.md entry either exists (noted, not fatal — the
//                tree is allowed to be ahead of the prose) or has a plausible
//                name
//   chapters  3. chapter headings: exactly one H1, first line of the file, no
//                skipped levels
//             4. code fences: balanced, always tagged with a language (the
//                language may be given plainly as ```go or as a pandoc
//                attribute block, ```{.go}, with optional extras such as
//                filename="Numbers.java")
//             5. text diagrams: `text`/`ascii` fences (tabular output, log
//                excerpts) stay within the 80-column print budget; `mermaid`
//                fences are verified to parse by the build-time renderer
//                (src/diagrams/render.ts)
//             6. housekeeping: no tabs, no trailing whitespace, file ends with
//                a newline, prose lines stay inside the 100-column budget —
//                unless the line carries a run of non-space characters longer
//                than the budget, which no wrapping could bring inside it (a
//                long URL destination, most of the time)
//   links     7. internal links and anchors resolve
//   config    8. book.config.json matches book.schema.json (advisory: unknown
//                keys and values the engine would ignore are warnings)

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Reporter } from "./reporter.js";
import { checkChapter, checkTree, summaryLinks } from "./structural-checks.js";
import { checkConfig } from "./config-checks.js";
import { anchorIndexOf, checkLinks } from "./link-checks.js";
import { markdownFilesUnder } from "./paths.js";
import type { BookConfig } from "../../lib/book-config.js";

const CHECKS = ["summary", "chapters", "links", "config"] as const;
type CheckName = (typeof CHECKS)[number];

function isCheckName(value: string): value is CheckName {
  return (CHECKS as readonly string[]).includes(value);
}

export function main(cfg: BookConfig, args: string[]): number {
  const verbose = args.includes("-v") || args.includes("--verbose");
  const selected = args.filter((arg) => !arg.startsWith("-"));
  const unknown = selected.filter((arg) => !isCheckName(arg));
  if (unknown.length) {
    process.stderr.write(`lint: unknown check '${unknown[0]}' (choose from ${CHECKS.join(", ")})\n`);
    return 2;
  }
  const wanted = new Set<CheckName>(selected.length ? selected.filter(isCheckName) : [...CHECKS]);

  const reporter = new Reporter(cfg.root);

  // Every family needs the same file lists: the plan from SUMMARY.md, and the
  // written files on disk (planned first, then any unlisted strays).
  const plannedPaths = summaryLinks(cfg, reporter);
  const planned = new Set(plannedPaths.map((p) => path.resolve(cfg.bookDir, p)));
  const plannedFiles = plannedPaths.map((p) => path.join(cfg.bookDir, p));
  const written = plannedFiles.filter((p) => fs.existsSync(p));
  written.push(...markdownFilesUnder(cfg.chapters).filter((p) => !plannedFiles.includes(p)).sort());

  if (wanted.has("summary")) {
    checkTree(cfg, reporter, plannedPaths);
  }

  if (wanted.has("chapters")) {
    for (const chapter of written) {
      checkChapter(cfg, reporter, chapter);
    }
  }

  if (wanted.has("links")) {
    // The anchors every chapter declares, built once from the same walk the
    // builders use; each link is then checked against it.
    const index = anchorIndexOf(cfg, written);

    for (const chapter of written) {
      checkLinks(cfg, reporter, chapter, index, planned);
    }

    // The summary's chapter paths are written from the book directory, not from
    // the file, which a config may put elsewhere.
    if (fs.existsSync(cfg.summary)) {
      checkLinks(cfg, reporter, cfg.summary, index, planned, cfg.bookDir);
    }

    for (const extra of [cfg.readme, ...cfg.docs]) {
      if (fs.existsSync(extra)) {
        checkLinks(cfg, reporter, extra, index, planned);
      }
    }
  }

  if (wanted.has("config")) {
    checkConfig(cfg, reporter);
  }

  for (const message of reporter.warnings) {
    console.log(`warning: ${message}`);
  }
  for (const message of reporter.errors) {
    console.error(`error: ${message}`);
  }

  if (reporter.notes.length) {
    const buckets = new Map<string, number>();
    for (const message of reporter.notes) {
      const idx = message.indexOf(": ");
      const kind = idx === -1 ? message : message.slice(0, idx);
      buckets.set(kind, (buckets.get(kind) ?? 0) + 1);
    }
    for (const kind of [...buckets.keys()].sort()) {
      console.log(`note: ${buckets.get(kind)} x ${kind}`);
    }
    if (verbose) {
      for (const message of reporter.notes) {
        console.log(`  ${message}`);
      }
    }
  }

  const summary =
    `\n${written.length} chapter file(s), ${reporter.errors.length} error(s), ${reporter.warnings.length} warning(s)`;
  if (reporter.errors.length) {
    console.error(summary);
  } else {
    console.log(summary);
  }
  return reporter.errors.length ? 1 : 0;
}
