import fs from "node:fs";
import path from "node:path";
import type { Reporter } from "./errors.js";
import { slugify, splitLines } from "../lib/markdown.js";
import {
  linkTargets,
  matchFence,
  matchHeading,
  stripCodeSpans,
} from "./markdown.js";

/** Resolve every internal link in `file`, checking targets and anchors. */
export function checkLinks(
  reporter: Reporter,
  file: string,
  allFiles: string[],
  planned: Set<string>,
): void {
  const anchors = new Map<string, Set<string>>();

  for (const targetPath of allFiles) {
    const heads: string[] = [];
    let inFence = false;
    for (const line of splitLines(fs.readFileSync(targetPath, "utf8"))) {
      if (matchFence(line)) {
        inFence = !inFence;
        continue;
      }
      if (inFence) {
        continue;
      }
      const heading = matchHeading(line);
      if (heading) {
        heads.push(slugify(heading.text));
      }
    }
    anchors.set(targetPath, new Set(heads));
  }

  // Skip link bodies inside fenced code.
  const lines = splitLines(fs.readFileSync(file, "utf8"));
  let inFence = false;
  for (const [idx, line] of lines.entries()) {
    const i = idx + 1;
    if (matchFence(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }
    for (const { target } of linkTargets(stripCodeSpans(line))) {
      const trimmed = target.trim();
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("mailto:")) {
        continue;
      }
      const hashIdx = trimmed.indexOf("#");
      const pathPart = hashIdx === -1 ? trimmed : trimmed.slice(0, hashIdx);
      const anchor = hashIdx === -1 ? "" : trimmed.slice(hashIdx + 1);
      let resolved: string;

      if (!pathPart) {
        resolved = file;
      } else {
        const candidate = path.resolve(path.dirname(file), pathPart);
        if (!fs.existsSync(candidate)) {
          // A link into a chapter that is planned but not written yet is
          // fine — the tree is meant to run ahead of the prose.
          if (planned.has(candidate)) {
            reporter.notes.push(`links to unwritten chapter: ${trimmed}`);
          } else {
            reporter.error(file, i, `link target does not exist: ${trimmed}`);
          }
          continue;
        }
        resolved = candidate;
      }
      if (anchor && path.extname(resolved) === ".md"
        && !(anchors.get(resolved) ?? new Set<string>()).has(anchor)) {
        reporter.error(file, i, `anchor #${anchor} not found in ${pathPart}`);
      }
    }
  }
}
