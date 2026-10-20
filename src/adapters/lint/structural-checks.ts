// The summary and chapter families: the chapter tree against the prose, and the
// shape of each chapter file.
//
// The line-level rules (fences, widths, whitespace, headings) read raw lines so
// their line numbers and columns stay exact; the tree rules read SUMMARY.md and
// the directory it names.

import fs from "node:fs";
import path from "node:path";
import type { BookSettings } from "../../application/settings.js";
import { splitLines } from "../../domain/values/text.js";
import { parseSummary } from "../../domain/services/summary.js";
import type { Reporter } from "./reporter.js";
import { hasMarkdown, markdownFilesUnder } from "./paths.js";
import {
  expandTabs,
  matchFence,
  matchHeading,
  parseFenceLang,
  type Heading,
} from "./lines.js";

/** The prose directory as SUMMARY.md writes it, relative to the book directory. */
function chaptersRel(cfg: BookSettings): string {
  return path.relative(cfg.bookDir, cfg.chapters).split(path.sep).join("/");
}

// ---------------------------------------------------------------------------
// The chapter tree (the `summary` family)
// ---------------------------------------------------------------------------

/** Every chapter path listed in SUMMARY.md, relative to `cfg.bookDir`. */
export function summaryLinks(cfg: BookSettings, reporter: Reporter): string[] {
  if (!fs.existsSync(cfg.summary)) {
    reporter.errors.push(`${path.relative(cfg.root, cfg.summary)}: missing`);
    return [];
  }
  return parseSummary(fs.readFileSync(cfg.summary, "utf8"))
    .filter((item) => {
      const rel = item.relBook ?? "";
      return item.kind === "entry" && rel.startsWith(`${chaptersRel(cfg)}/`) && rel.endsWith(".md");
    })
    .map((item) => item.relBook as string);
}

/** A chapter is open while a top-level item has been seen; indented sections
 *  must come after it. The parsed SUMMARY tree makes that order visible. */
function checkSummaryStructure(cfg: BookSettings, reporter: Reporter): void {
  if (!fs.existsSync(cfg.summary)) {
    return;
  }

  let chapterOpen = false;
  for (const item of parseSummary(fs.readFileSync(cfg.summary, "utf8"))) {
    if (item.kind === "group") {
      chapterOpen = false;
      continue;
    }
    if (item.kind === "entry") {
      const indented = (item.indent ?? 0) > 0;
      if (indented && !chapterOpen) {
        reporter.error(cfg.summary, item.line ?? 0, "section listed before any chapter in this group");
      }
      if (!indented) {
        chapterOpen = true;
      }
    }
  }
}

/** The chapter tree against the prose that actually exists. */
export function checkTree(cfg: BookSettings, reporter: Reporter, planned: string[]): void {
  checkSummaryStructure(cfg, reporter);

  if (!fs.existsSync(cfg.chapters)) {
    reporter.errors.push(`${chaptersRel(cfg)}/: missing directory`);
    return;
  }

  const onDisk = markdownFilesUnder(cfg.chapters)
    .map((p) => path.relative(cfg.bookDir, p).split(path.sep).join("/"))
    .sort();
  const listed = new Set(planned);

  for (const p of onDisk) {
    if (!listed.has(p)) {
      reporter.error(path.join(cfg.bookDir, p), null, `not listed in ${path.relative(cfg.root, cfg.summary)}`);
    }
  }

  for (const p of planned) {
    const full = path.join(cfg.bookDir, p);
    if (!fs.existsSync(full)) {
      reporter.notes.push(`planned chapter, not written yet: ${p}`);
      continue;
    }
    if (path.basename(full) !== "00_index.md"
      && !fs.existsSync(path.join(path.dirname(full), "00_index.md"))) {
      reporter.warn(full, null,
        `no 00_index.md in ${path.basename(path.dirname(full))}/ — the group's chapter is missing`);
    }
  }

  const groups = fs.readdirSync(cfg.chapters, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(cfg.chapters, entry.name))
    .sort();
  for (const group of groups) {
    if (!hasMarkdown(group)) {
      reporter.error(group, null, "chapter group has no markdown files");
    }
  }
}

// ---------------------------------------------------------------------------
// One chapter file (the `chapters` family)
// ---------------------------------------------------------------------------

/** Structural checks for a single chapter file. */
export function checkChapter(cfg: BookSettings, reporter: Reporter, file: string): void {
  const raw = fs.readFileSync(file, "utf8");

  if (raw && !raw.endsWith("\n")) {
    reporter.error(file, splitLines(raw).length, "file does not end with a newline");
  }

  const lines = splitLines(raw);
  let inFence = false;
  let fenceOpen = { ticks: "", info: "" };
  let fenceLang = "";
  let diagramStart = 0;

  const headings: Heading[] = [];

  for (const [idx, line] of lines.entries()) {
    const i = idx + 1;
    const fence = matchFence(line);

    if (inFence) {
      // Closing fence: same character, at least as long, no info string.
      if (fence
        && fence.ticks[0] === fenceOpen.ticks[0]
        && fence.ticks.length >= fenceOpen.ticks.length
        && !fence.info.trim()) {
        if (fenceLang === "text" || fenceLang === "plaintext" || fenceLang === "ascii") {
          const width = maxDiagramWidth(lines.slice(diagramStart, i - 1));
          if (width > cfg.lint.diagramWidth) {
            reporter.error(file, diagramStart + 1,
              `text diagram is ${width} columns wide, budget is ${cfg.lint.diagramWidth}`);
          }
        }
        inFence = false;
        fenceOpen = { ticks: "", info: "" };
        fenceLang = "";
      }
      continue;
    }

    if (fence) {
      inFence = true;
      fenceOpen = fence;
      fenceLang = parseFenceLang(fence.info);
      diagramStart = i;
      if (!fenceLang) {
        reporter.error(file, i, "fenced block has no language tag (use `text` for output, `mermaid` for diagrams)");
      } else if (!cfg.languages.has(fenceLang)) {
        reporter.warn(file, i, `unusual code fence language '${fenceLang}'`);
      }
      continue;
    }

    if (line.trimEnd() !== line) {
      reporter.error(file, i, "trailing whitespace");
    }

    if (line.includes("\t")) {
      reporter.error(file, i, "tab character — indent with spaces");
    }

    if (line.length > cfg.lint.proseWidth) {
      if (line.trimStart().startsWith("|")) {
        if (line.length > cfg.lint.tableWidth) {
          reporter.error(file, i, `table row is ${line.length} columns, budget is ${cfg.lint.tableWidth}`);
        }
      } else if (!hasUnbreakableRun(cfg, line)) {
        reporter.error(file, i, `line is ${line.length} columns, budget is ${cfg.lint.proseWidth}`);
      }
    }

    const heading = matchHeading(line);
    if (heading) {
      headings.push([heading.level, heading.text, i]);
    }
  }

  if (inFence) {
    reporter.error(file, null, "unterminated code fence");
  }

  checkHeadings(reporter, file, headings);
}

/**
 * True when no wrapping could bring the line inside the budget: one run of
 * non-space characters is longer than the budget itself, so it fits on no line.
 * A URL destination or a pasted identifier is the usual reason, and there is
 * nothing in the line for the writer to cut.
 */
function hasUnbreakableRun(cfg: BookSettings, line: string): boolean {
  return line.split(/\s+/).some((run) => run.length > cfg.lint.proseWidth);
}

export function checkHeadings(reporter: Reporter, file: string, headings: Heading[]): void {
  if (headings.length === 0) {
    reporter.error(file, 1, "no headings — every chapter needs a title");
    return;
  }

  const h1s = headings.filter((h) => h[0] === 1);

  if (h1s.length !== 1) {
    reporter.error(file, h1s.length ? h1s[0][2] : headings[0][2],
      `expected exactly one H1 title, found ${h1s.length}`);
  } else if (headings[0][0] !== 1) {
    reporter.error(file, headings[0][2], "file must start with its H1 title");
  }

  for (let n = 1; n < headings.length; n++) {
    const [level, , lineNo] = headings[n];
    const [prevLevel, , prevLineNo] = headings[n - 1];
    if (level > prevLevel + 1) {
      reporter.error(file, lineNo,
        `heading jumps from H${prevLevel} (line ${prevLineNo}) to H${level}`);
    }
  }
}

/** Width of the widest non-empty line, counting tabs as 4 columns. */
export function maxDiagramWidth(block: string[]): number {
  let width = 0;
  for (const line of block) {
    width = Math.max(width, expandTabs(line).trimEnd().length);
  }
  return width;
}
