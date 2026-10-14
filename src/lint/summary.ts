import fs from "node:fs";
import path from "node:path";
import type { Reporter } from "./errors.js";
import { parseSummary } from "../lib/summary.js";
import { BOOK, CHAPTERS, hasMarkdown, markdownFilesUnder, SUMMARY } from "./paths.js";

/** Every chapter path listed in SUMMARY.md, relative to BOOK. */
export function summaryLinks(reporter: Reporter): string[] {
  if (!fs.existsSync(SUMMARY)) {
    reporter.errors.push("SUMMARY.md: missing");
    return [];
  }
  return parseSummary(fs.readFileSync(SUMMARY, "utf8"))
    .filter((item) => {
      const rel = item.relBook ?? "";
      return item.kind === "entry" && rel.startsWith("chapters/") && rel.endsWith(".md");
    })
    .map((item) => item.relBook as string);
}

/** A chapter is open while a top-level item has been seen; indented sections
 *  must come after it. The parsed SUMMARY tree makes that order visible. */
function checkSummaryStructure(reporter: Reporter): void {
  if (!fs.existsSync(SUMMARY)) {
    return;
  }

  let chapterOpen = false;
  for (const item of parseSummary(fs.readFileSync(SUMMARY, "utf8"))) {
    if (item.kind === "group") {
      chapterOpen = false;
      continue;
    }
    if (item.kind === "entry") {
      const indented = (item.indent ?? 0) > 0;
      if (indented && !chapterOpen) {
        reporter.error(SUMMARY, item.line ?? 0, "section listed before any chapter in this group");
      }
      if (!indented) {
        chapterOpen = true;
      }
    }
  }
}

/** The chapter tree against the prose that actually exists. */
export function checkTree(reporter: Reporter, planned: string[]): void {
  checkSummaryStructure(reporter);

  if (!fs.existsSync(CHAPTERS)) {
    reporter.errors.push("chapters/: missing directory");
    return;
  }

  const onDisk = markdownFilesUnder(CHAPTERS)
    .map((p) => path.relative(BOOK, p).split(path.sep).join("/"))
    .sort();
  const listed = new Set(planned);

  for (const p of onDisk) {
    if (!listed.has(p)) {
      reporter.error(path.join(BOOK, p), null, "not listed in SUMMARY.md");
    }
  }

  for (const p of planned) {
    const full = path.join(BOOK, p);
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

  const groups = fs.readdirSync(CHAPTERS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(CHAPTERS, entry.name))
    .sort();
  for (const group of groups) {
    if (!hasMarkdown(group)) {
      reporter.error(group, null, "chapter group has no markdown files");
    }
  }
}
