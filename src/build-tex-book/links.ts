// Where a link points, as the book's tree names it (see ir.ts): a place in the
// book, or `null` for an outside URL.

import path from "node:path";
import type { ChapterContext } from "./ir.js";

/**
 * The place in the book a link points at, or `null` for an outside URL.
 *
 * Intra-book targets are the same ids the web build gives its headings: relative
 * `.md` paths resolve against the chapter's own directory through the book's
 * chapter map, and a bare `#anchor` names a heading of this chapter.
 */
export function linkTarget(href: string, ctx: ChapterContext): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return null;
  const hash = href.indexOf("#");
  const rawPath = hash === -1 ? href : href.slice(0, hash);
  const anchor = hash === -1 ? "" : href.slice(hash + 1);
  if (rawPath === "") {
    return anchor === "" ? null : `c${ctx.chapterId}--${anchor}`;
  }
  if (!rawPath.toLowerCase().endsWith(".md")) return null;
  const fromDir = path.posix.dirname(ctx.relBook);
  const targetId = ctx.idOf.get(path.posix.normalize(path.posix.join(fromDir, rawPath)));
  if (targetId === undefined) return null;
  return anchor === "" ? `c${targetId}` : `c${targetId}--${anchor}`;
}
