import fs from "node:fs";
import type { Reporter } from "./errors.js";
import { CONFIG } from "../lib/book-config.js";
import { splitLines } from "../lib/markdown.js";
import {
  expandTabs,
  matchFence,
  matchHeading,
  MAX_DIAGRAM_COLS,
  MAX_LINE,
  MAX_TABLE_LINE,
  parseFenceLang,
  type Heading,
} from "./markdown.js";

/** Structural checks for a single chapter file. */
export function checkChapter(reporter: Reporter, file: string): void {
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
          if (width > MAX_DIAGRAM_COLS) {
            reporter.error(file, diagramStart + 1,
              `text diagram is ${width} columns wide, budget is ${MAX_DIAGRAM_COLS}`);
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
      } else if (!CONFIG.languages.has(fenceLang)) {
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

    if (line.length > MAX_LINE) {
      if (line.trimStart().startsWith("|")) {
        if (line.length > MAX_TABLE_LINE) {
          reporter.error(file, i, `table row is ${line.length} columns, budget is ${MAX_TABLE_LINE}`);
        }
      } else if (!hasUnbreakableRun(line)) {
        reporter.error(file, i, `line is ${line.length} columns, budget is ${MAX_LINE}`);
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
function hasUnbreakableRun(line: string): boolean {
  return line.split(/\s+/).some((run) => run.length > MAX_LINE);
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
