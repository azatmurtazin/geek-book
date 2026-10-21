// The summary and chapter families: the chapter tree against the prose on
// disk, and the line-level shape of one chapter file. The messages are part of
// the linter's contract (`lint.txt` freezes them), so each case asserts the
// exact text and line, not just that something was reported.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { BookSettings } from "../../../src/application/settings.js";
import { Reporter } from "../../../src/adapters/lint/reporter.js";
import {
  checkChapter,
  checkTree,
  maxDiagramWidth,
  summaryLinks,
} from "../../../src/adapters/lint/structural-checks.js";
import { loadFrom } from "../../helpers/config.js";

const tempDirs: string[] = [];

afterAll(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/** A book root holding `files` (repo-relative paths), loaded like the CLI does. */
function makeBook(files: Record<string, string>, config: Record<string, unknown> = {}): BookSettings {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "geek-book-structural-"));
  tempDirs.push(root);
  fs.writeFileSync(path.join(root, "book.config.json"), JSON.stringify(config));
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  return loadFrom(root);
}

/** Run `checkChapter` over one chapter file in a one-chapter book. */
function lintChapter(source: string, config: Record<string, unknown> = {}): Reporter {
  const cfg = makeBook({ "book/chapters/one.md": source }, config);
  const reporter = new Reporter(cfg.root);
  checkChapter(cfg, reporter, path.join(cfg.chapters, "one.md"));
  return reporter;
}

describe("summaryLinks", () => {
  it("reports a missing SUMMARY.md and returns nothing", () => {
    const cfg = makeBook({});
    const reporter = new Reporter(cfg.root);
    expect(summaryLinks(cfg, reporter)).toEqual([]);
    expect(reporter.errors).toEqual(["book/SUMMARY.md: missing"]);
  });

  it("keeps the chapter entries under the prose directory, in order", () => {
    const cfg = makeBook({
      "book/SUMMARY.md": [
        "# Summary",
        "",
        "- [Intro](README.md)",
        "- [One](chapters/one.md)",
        "  - [Section](chapters/one/section.md)",
        "- [Notes](notes/misc.md)",
        "",
      ].join("\n"),
    });
    const reporter = new Reporter(cfg.root);
    expect(summaryLinks(cfg, reporter)).toEqual(["chapters/one.md", "chapters/one/section.md"]);
    expect(reporter.errors).toEqual([]);
  });
});

describe("checkTree — SUMMARY.md against the prose", () => {
  it("flags a section listed before any chapter in its group", () => {
    const cfg = makeBook({
      "book/SUMMARY.md": [
        "# Summary",
        "",
        "# Group",
        "  - [Orphan](chapters/group/orphan.md)",
      ].join("\n"),
      "book/chapters/group/orphan.md": "# Orphan\n",
    });
    const reporter = new Reporter(cfg.root);
    checkTree(cfg, reporter, ["chapters/group/orphan.md"]);
    expect(reporter.errors).toEqual([
      "book/SUMMARY.md:4: section listed before any chapter in this group",
    ]);
  });

  it("reports a written chapter nobody listed, and notes a listed one not written", () => {
    const cfg = makeBook({
      "book/SUMMARY.md": [
        "# Summary",
        "",
        "- [One](chapters/one.md)",
        "- [Later](chapters/later.md)",
      ].join("\n"),
      "book/chapters/one.md": "# One\n",
      "book/chapters/unlisted.md": "# Unlisted\n",
    });
    const reporter = new Reporter(cfg.root);
    checkTree(cfg, reporter, ["chapters/one.md", "chapters/later.md"]);
    expect(reporter.errors).toEqual([
      "book/chapters/unlisted.md: not listed in book/SUMMARY.md",
    ]);
    expect(reporter.notes).toEqual(["planned chapter, not written yet: chapters/later.md"]);
  });

  it("warns about a missing group index and errors on an empty group", () => {
    const cfg = makeBook({
      "book/SUMMARY.md": "# Summary\n\n- [One](chapters/group/one.md)\n",
      "book/chapters/group/one.md": "# One\n",
      "book/chapters/empty/.keep": "",
    });
    const reporter = new Reporter(cfg.root);
    checkTree(cfg, reporter, ["chapters/group/one.md"]);
    expect(reporter.warnings).toEqual([
      "book/chapters/group/one.md: no 00_index.md in group/ — the group's chapter is missing",
    ]);
    expect(reporter.errors).toEqual([
      "book/chapters/empty: chapter group has no markdown files",
    ]);
  });

  it("reports a missing prose directory once", () => {
    const cfg = makeBook({ "book/SUMMARY.md": "# Summary\n" });
    const reporter = new Reporter(cfg.root);
    checkTree(cfg, reporter, []);
    expect(reporter.errors).toEqual(["chapters/: missing directory"]);
  });
});

describe("checkChapter — the shape of one file", () => {
  it("accepts a clean chapter", () => {
    const reporter = lintChapter("# Title\n\nA paragraph.\n");
    expect(reporter.errors).toEqual([]);
    expect(reporter.warnings).toEqual([]);
  });

  it("requires a final newline", () => {
    const reporter = lintChapter("# Title\n\nText");
    expect(reporter.errors).toEqual(["book/chapters/one.md:3: file does not end with a newline"]);
  });

  it("flags trailing whitespace and tabs", () => {
    const reporter = lintChapter("# Title\n\nText \n\tIndented\n");
    expect(reporter.errors).toEqual([
      "book/chapters/one.md:3: trailing whitespace",
      "book/chapters/one.md:4: tab character — indent with spaces",
    ]);
  });

  it("wants a language on every fence, and notices an unusual one", () => {
    const reporter = lintChapter([
      "# Title",
      "",
      "```",
      "bare",
      "```",
      "",
      "```brainfuck",
      "+++",
      "```",
      "",
    ].join("\n"));
    expect(reporter.errors).toEqual([
      "book/chapters/one.md:3: fenced block has no language tag (use `text` for output, `mermaid` for diagrams)",
    ]);
    expect(reporter.warnings).toEqual([
      "book/chapters/one.md:7: unusual code fence language 'brainfuck'",
    ]);
  });

  it("reports an unterminated fence", () => {
    const reporter = lintChapter("# Title\n\n```text\nleft open\n");
    expect(reporter.errors).toEqual(["book/chapters/one.md: unterminated code fence"]);
  });

  it("enforces the text-diagram budget at its first content line", () => {
    const reporter = lintChapter("# Title\n\n```text\n12345678\n```\n", {
      lint: { diagramWidth: 5 },
    });
    expect(reporter.errors).toEqual([
      "book/chapters/one.md:4: text diagram is 8 columns wide, budget is 5",
    ]);
  });

  it("distinguishes a wrappable line from an unbreakable one", () => {
    const long = lintChapter(`# Title\n\n${"word ".repeat(6).trim()}\n`, { lint: { proseWidth: 20 } });
    expect(long.errors).toEqual(["book/chapters/one.md:3: line is 29 columns, budget is 20"]);

    const unbreakable = lintChapter("# Title\n\nhttps://example.test/a/very/long/path\n", {
      lint: { proseWidth: 20 },
    });
    expect(unbreakable.errors).toEqual([]);
  });

  it("gives a table row its own budget", () => {
    const reporter = lintChapter("# Title\n\n| a | b | c | d |\n", {
      lint: { proseWidth: 10, tableWidth: 12 },
    });
    expect(reporter.errors).toEqual([
      "book/chapters/one.md:3: table row is 17 columns, budget is 12",
    ]);
  });

  it("wants one H1, first, with no skipped levels", () => {
    expect(lintChapter("").errors).toEqual(["book/chapters/one.md:1: no headings — every chapter needs a title"]);
    expect(lintChapter("# One\n\n# Two\n").errors).toEqual([
      "book/chapters/one.md:1: expected exactly one H1 title, found 2",
    ]);
    expect(lintChapter("## Sub\n\n# Title\n").errors).toEqual([
      "book/chapters/one.md:1: file must start with its H1 title",
    ]);
    expect(lintChapter("# Title\n\n### Deep\n").errors).toEqual([
      "book/chapters/one.md:3: heading jumps from H1 (line 1) to H3",
    ]);
  });
});

describe("maxDiagramWidth", () => {
  it("measures the widest line, expanding tabs to four columns", () => {
    expect(maxDiagramWidth(["ab", "\tcd", "", "  e  "])).toBe(6);
  });
});
