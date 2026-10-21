// The linter's file handling: which files a family reads, and the order in which
// `lintBook` sees them. The individual rules live in their own suites; this one
// drives `BookLintChecks` over a small book so the port's implementation is
// covered as a whole, including the merge of the three message lists.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { LintOutput } from "../../../src/application/ports/lint-checks.js";
import { BookLintChecks } from "../../../src/adapters/lint/book-checks.js";
import { hasMarkdown, markdownFilesUnder } from "../../../src/adapters/lint/paths.js";
import { loadFrom } from "../../helpers/config.js";

const tempDirs: string[] = [];

afterAll(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function emptyOutput(): LintOutput {
  return { errors: [], warnings: [], notes: [] };
}

/** A book with one group, one valid cross-chapter link, an unlisted file and a
 *  config typo, so every family has something to say. */
function makeBook() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "geek-book-checks-"));
  tempDirs.push(root);
  const files: Record<string, string> = {
    "book.config.json": JSON.stringify({ title: "Checks", nope: 1 }),
    "book/SUMMARY.md": [
      "# Summary",
      "",
      "- [Group](chapters/00_index.md)",
      "  - [One](chapters/one.md)",
      "  - [Two](chapters/two.md)",
      "",
    ].join("\n"),
    "book/chapters/00_index.md": "# Group\n",
    "book/chapters/one.md": "# One\n\nSee [Two](two.md#section).\n",
    "book/chapters/two.md": "# Two\n\n## Section\n",
    "book/chapters/extra.md": "# Extra\n",
  };
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  return loadFrom(root);
}

describe("BookLintChecks", () => {
  it("plans the summary's chapters and reads the written ones in that order", () => {
    const settings = makeBook();
    const checks = new BookLintChecks();
    const out = emptyOutput();

    const planned = checks.plan(settings, out);
    expect(planned).toEqual(["chapters/00_index.md", "chapters/one.md", "chapters/two.md"]);

    const written = checks.written(settings, planned).map((file) => path.relative(settings.bookDir, file));
    // The summary order first, then prose nobody listed, sorted.
    expect(written).toEqual([
      "chapters/00_index.md",
      "chapters/one.md",
      "chapters/two.md",
      "chapters/extra.md",
    ]);
    expect(out).toEqual(emptyOutput());
  });

  it("merges every family's findings into the one output", () => {
    const settings = makeBook();
    const checks = new BookLintChecks();
    const out = emptyOutput();
    const planned = checks.plan(settings, out);
    const written = checks.written(settings, planned);

    checks.summary(settings, out, planned);
    for (const file of written) {
      checks.chapter(settings, out, file);
    }
    checks.links(settings, out, written, new Set(planned.map((rel) => path.join(settings.bookDir, rel))));
    checks.config(settings, out);

    expect(out.errors).toEqual(["book/chapters/extra.md: not listed in book/SUMMARY.md"]);
    expect(out.warnings).toEqual(["book.config.json: nope: unknown key"]);
    expect(out.notes).toEqual([]);
  });
});

describe("markdownFilesUnder", () => {
  it("walks nested directories, keeps only .md, and tolerates a missing root", () => {
    const settings = makeBook();
    const found = markdownFilesUnder(settings.chapters)
      .map((file) => path.basename(file))
      .sort();
    expect(found).toEqual(["00_index.md", "extra.md", "one.md", "two.md"]);
    expect(markdownFilesUnder(path.join(settings.root, "nowhere"))).toEqual([]);
    expect(hasMarkdown(settings.chapters)).toBe(true);

    // `hasMarkdown` takes a directory that exists (the tree check tests first);
    // a directory with no Markdown is what it answers false for.
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "geek-book-empty-"));
    tempDirs.push(empty);
    fs.writeFileSync(path.join(empty, "notes.txt"), "");
    expect(hasMarkdown(empty)).toBe(false);
  });
});
