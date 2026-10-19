// `lint`'s use case: check the book's sources and answer what was found.
//
// The run has the shape the four families always shared: read the plan from
// SUMMARY.md, take the files on disk, then visit the families in order against
// that one file list. What each family looks at is the `LintChecks` port's
// business. Findings come back as three message lists — this use case chooses
// no stream, no format and no exit code, so the same run can be reported by the
// CLI or asserted on in a test.

import type { LintChecks, LintFamily, LintOutput } from "../ports/lint-checks.js";
import { resolve } from "../../domain/values/posix-path.js";
import type { BookSettings } from "../settings.js";

export interface LintBookDeps {
  readonly settings: BookSettings;
  readonly checks: LintChecks;
}

export interface LintBookOptions {
  /** The families to run; `LINT_FAMILIES` when the reader names none. */
  readonly families: ReadonlySet<LintFamily>;
}

/** What a lint run found, and how much of the book it looked at. */
export interface LintReport {
  /** Chapter files checked (planned and present, plus unlisted strays). */
  readonly chapters: number;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly notes: readonly string[];
}

/** Check the book's sources; the findings are data, not a failure. */
export function lintBook(deps: LintBookDeps, options: LintBookOptions): LintReport {
  const { settings, checks } = deps;
  const out: LintOutput = { errors: [], warnings: [], notes: [] };

  // Every family needs the same file lists: the plan from SUMMARY.md, and the
  // written files on disk (planned first, then any unlisted strays).
  const planned = checks.plan(settings, out);
  const written = checks.written(settings, planned);

  if (options.families.has("summary")) {
    checks.summary(settings, out, planned);
  }
  if (options.families.has("chapters")) {
    for (const chapter of written) {
      checks.chapter(settings, out, chapter);
    }
  }
  if (options.families.has("links")) {
    checks.links(settings, out, written, new Set(planned.map((rel) => resolve(settings.bookDir, rel))));
  }
  if (options.families.has("config")) {
    checks.config(settings, out);
  }

  return { chapters: written.length, errors: out.errors, warnings: out.warnings, notes: out.notes };
}
