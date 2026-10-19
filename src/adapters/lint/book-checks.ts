// The book's lint checks, moved behind the `LintChecks` port.
//
// This is where the linter's file handling lives: which files a family reads,
// and how the collectors' three message lists are merged. The checks themselves
// stay in their own modules (`structural-checks.ts`, `link-checks.ts`,
// `config-checks.ts`), unchanged, each answering through the linter's own
// `Reporter`, which prefixes every message with the file's path from the book
// root.

import fs from "node:fs";
import path from "node:path";
import type { LintChecks, LintOutput } from "../../application/ports/lint-checks.js";
import type { BookSettings } from "../../application/settings.js";
import { checkConfig } from "./config-checks.js";
import { anchorIndexOf, checkLinks } from "./link-checks.js";
import { markdownFilesUnder } from "./paths.js";
import { Reporter } from "./reporter.js";
import { checkChapter, checkTree, summaryLinks } from "./structural-checks.js";

/** Run a family's checks over a fresh collector and append what it found. */
function collect(settings: BookSettings, out: LintOutput, run: (reporter: Reporter) => void): void {
  const reporter = new Reporter(settings.root);
  run(reporter);
  out.errors.push(...reporter.errors);
  out.warnings.push(...reporter.warnings);
  out.notes.push(...reporter.notes);
}

export class BookLintChecks implements LintChecks {
  plan(settings: BookSettings, out: LintOutput): string[] {
    let planned: string[] = [];
    collect(settings, out, (reporter) => {
      planned = summaryLinks(settings, reporter);
    });
    return planned;
  }

  written(settings: BookSettings, planned: readonly string[]): string[] {
    const plannedFiles = planned.map((rel) => path.join(settings.bookDir, rel));
    const written = plannedFiles.filter((file) => fs.existsSync(file));
    written.push(...markdownFilesUnder(settings.chapters).filter((file) => !plannedFiles.includes(file)).sort());
    return written;
  }

  summary(settings: BookSettings, out: LintOutput, planned: readonly string[]): void {
    collect(settings, out, (reporter) => checkTree(settings, reporter, [...planned]));
  }

  chapter(settings: BookSettings, out: LintOutput, file: string): void {
    collect(settings, out, (reporter) => checkChapter(settings, reporter, file));
  }

  links(
    settings: BookSettings,
    out: LintOutput,
    written: readonly string[],
    planned: ReadonlySet<string>,
  ): void {
    collect(settings, out, (reporter) => {
      // The anchors every chapter declares, built once from the same walk the
      // builders use; each link is then checked against it.
      const index = anchorIndexOf(settings, written);
      for (const chapter of written) {
        checkLinks(settings, reporter, chapter, index, planned);
      }
      // The summary's chapter paths are written from the book directory, not
      // from the file, which a config may put elsewhere.
      if (fs.existsSync(settings.summary)) {
        checkLinks(settings, reporter, settings.summary, index, planned, settings.bookDir);
      }
      for (const extra of [settings.readme, ...settings.docs]) {
        if (fs.existsSync(extra)) {
          checkLinks(settings, reporter, extra, index, planned);
        }
      }
    });
  }

  config(settings: BookSettings, out: LintOutput): void {
    collect(settings, out, (reporter) => checkConfig(settings, reporter));
  }
}
