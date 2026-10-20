// The link family: internal links and anchors, and book pictures.
//
// `checkLinks` walks each file's raw lines (so a bad link is reported at its own
// line) but asks the shared `AnchorIndex` whether the anchor a link names
// exists — the same anchors `assemble` gives the headings, with no second
// Markdown parse and no second slug rule in the linter.

import fs from "node:fs";
import path from "node:path";
import type { BookConfig } from "../../lib/book-config.js";
import { splitLines } from "../../domain/values/text.js";
import { assemble } from "../../domain/services/assemble.js";
import { indexAnchors, type AnchorIndex } from "../../domain/services/anchor-index.js";
import { MarkedParser } from "../markdown/marked-parser.js";
import { substituteContentPlaceholders } from "../../lib/content-placeholders.js";
import { isRemoteImage, resolveImagePath } from "../../lib/images.js";
import type { Reporter } from "./reporter.js";
import {
  imageTargets,
  linkTargets,
  matchFence,
  stripCodeSpans,
} from "./lines.js";

/**
 * The anchor index of the written chapters, keyed by book-relative path.
 *
 * Each chapter is run through the same lex → assemble walk the builders use, so
 * the anchors here are the ones the renderers actually emit: `c3` on a title,
 * `c3--a-slug` below, smartened exactly as the book asks.
 */
export function anchorIndexOf(cfg: BookConfig, files: readonly string[]): AnchorIndex {
  const parser = new MarkedParser(cfg.markdown.breaks);
  const relBooks = files.map((file) => path.relative(cfg.bookDir, file).split(path.sep).join("/"));
  const idOf = new Map(relBooks.map((rel, id) => [rel, id]));

  const chapters = files.map((file, id) => {
    const source = substituteContentPlaceholders(cfg, fs.readFileSync(file, "utf8"));
    const { blocks } = assemble(parser.lex(source), { chapterId: id, relBook: relBooks[id], idOf }, {
      bookDir: cfg.bookDir,
      smartTypography: cfg.markdown.smartTypography,
    });
    return { relBook: relBooks[id], id, blocks };
  });

  return indexAnchors(chapters);
}

/** Resolve every internal link in `file`, checking targets and anchors.
 *
 * `linkBase` is what relative links resolve against — by default the file's own
 * directory, as Markdown means it. The summary passes the book directory, since
 * its chapter paths are always written from there, wherever the file itself
 * lives. */
export function checkLinks(
  cfg: BookConfig,
  reporter: Reporter,
  file: string,
  index: AnchorIndex,
  planned: ReadonlySet<string>,
  linkBase: string = path.dirname(file),
): void {
  const fromRelBook = path.relative(cfg.bookDir, file).split(path.sep).join("/");
  // The root docs (README.md, CHANGELOG.md) carry images no edition builds, so
  // only files inside the book directory are checked for them.
  const insideBook = fromRelBook !== "" && !fromRelBook.startsWith("..") && !path.isAbsolute(fromRelBook);

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
        const candidate = path.resolve(linkBase, pathPart);
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
      if (anchor && path.extname(resolved) === ".md") {
        const targetRel = path.relative(cfg.bookDir, resolved).split(path.sep).join("/");
        if (!index.hasAnchor(targetRel, anchor)) {
          reporter.error(file, i, `anchor #${anchor} not found in ${pathPart}`);
        }
      }
    }
    if (insideBook) {
      for (const target of imageTargets(stripCodeSpans(line))) {
        const src = target.trim();
        if (!src) {
          continue;
        }
        // Remote images are fetched at build time (src/adapters/http/remote-images.ts):
        // not an offline check's business, but the build then needs the network.
        if (isRemoteImage(src)) {
          reporter.notes.push(`remote image, fetched at build time: ${src}`);
          continue;
        }
        // Other schemes (data:, file:, protocol-relative) have no local file.
        if (/^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith("//")) {
          continue;
        }
        const relBook = resolveImagePath(src, fromRelBook);
        if (relBook === null) {
          reporter.error(file, i, `image is outside the book: ${src}`);
          continue;
        }
        if (!fs.existsSync(path.join(cfg.bookDir, relBook))) {
          reporter.error(file, i, `image does not exist: ${src}`);
        }
      }
    }
  }
}
