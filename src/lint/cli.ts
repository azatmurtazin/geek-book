// Structural checks for the book sources.
//
// Run with `npm run lint` (or `just lint`) for every family at once, or one
// family at a time with `npm run lint-summary`, `lint-chapters` or
// `lint-links`. Exits non-zero when something is wrong with the content or the
// chapter tree; style nits that are advisory are reported as warnings and do
// not fail the build.
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
//                a newline, prose lines stay inside the 100-column budget
//   links     7. internal links and anchors resolve

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Reporter } from "./errors.js";
import { checkChapter } from "./chapter.js";
import { checkLinks } from "./links.js";
import { checkTree, summaryLinks } from "./summary.js";
import { BOOK, CHAPTERS, README, ROOT, SUMMARY, markdownFilesUnder } from "./paths.js";
import { CONFIG } from "../lib/book-config.js";

const CHECKS = ["summary", "chapters", "links"] as const;
type CheckName = (typeof CHECKS)[number];

function isCheckName(value: string): value is CheckName {
  return (CHECKS as readonly string[]).includes(value);
}

export function main(args: string[]): number {
  const verbose = args.includes("-v") || args.includes("--verbose");
  const selected = args.filter((arg) => !arg.startsWith("-"));
  const unknown = selected.filter((arg) => !isCheckName(arg));
  if (unknown.length) {
    process.stderr.write(`lint: unknown check '${unknown[0]}' (choose from ${CHECKS.join(", ")})\n`);
    return 2;
  }
  const wanted = new Set<CheckName>(selected.length ? selected.filter(isCheckName) : [...CHECKS]);

  const reporter = new Reporter(ROOT);

  // Every family needs the same file lists: the plan from SUMMARY.md, and the
  // written files on disk (planned first, then any unlisted strays).
  const plannedPaths = summaryLinks(reporter);
  const planned = new Set(plannedPaths.map((p) => path.resolve(BOOK, p)));
  const plannedFiles = plannedPaths.map((p) => path.join(BOOK, p));
  const written = plannedFiles.filter((p) => fs.existsSync(p));
  written.push(...markdownFilesUnder(CHAPTERS).filter((p) => !plannedFiles.includes(p)).sort());

  if (wanted.has("summary")) {
    checkTree(reporter, plannedPaths);
  }

  if (wanted.has("chapters")) {
    for (const chapter of written) {
      checkChapter(reporter, chapter);
    }
  }

  if (wanted.has("links")) {
    for (const chapter of written) {
      checkLinks(reporter, chapter, written, planned);
    }

    for (const extra of [SUMMARY, README, ...CONFIG.docs]) {
      if (fs.existsSync(extra)) {
        checkLinks(reporter, extra, written, planned);
      }
    }
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
