import fs from "node:fs";
import path from "node:path";
import type { Reporter } from "./errors.js";
import { parseSummary } from "../lib/summary.js";
import { hasMarkdown, markdownFilesUnder } from "./paths.js";
import type { BookConfig } from "../lib/book-config.js";

/** The prose directory as SUMMARY.md writes it, relative to the book directory. */
function chaptersRel(cfg: BookConfig) {
  return path.relative(cfg.bookDir, cfg.chapters).split(path.sep).join("/");
}

/** Every chapter path listed in SUMMARY.md, relative to `cfg.bookDir`. */
export function summaryLinks(cfg: BookConfig, reporter: Reporter): string[] {
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
function checkSummaryStructure(cfg: BookConfig, reporter: Reporter): void {
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
export function checkTree(cfg: BookConfig, reporter: Reporter, planned: string[]): void {
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
