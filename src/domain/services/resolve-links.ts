// Where a link points, as the book's tree names it (see `domain/model/`): a
// place in the book, or `null` for an outside URL.
//
// Intra-book targets are the same ids the web build gives its headings: relative
// `.md` paths resolve against the chapter's own directory through the book's
// chapter map, and a bare `#anchor` names a heading of this chapter.
//
// Pure: part of `domain/`, imports nothing outside `domain/`.

import { dirname, join, normalize } from "../values/posix-path.js";

/** Where a chapter sits, for resolving its links against. */
export interface LinkOrigin {
  readonly chapterId: number;
  readonly relBook: string;
}

/**
 * The place in the book a link points at, or `null` for an outside URL.
 *
 * `from` is the chapter the link is written in; `chapterIds` maps every written
 * chapter's book-relative path to its id.
 */
export function resolveLink(
  href: string,
  from: LinkOrigin,
  chapterIds: ReadonlyMap<string, number>,
): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
    return null;
  }
  const hash = href.indexOf("#");
  const rawPath = hash === -1 ? href : href.slice(0, hash);
  const anchor = hash === -1 ? "" : href.slice(hash + 1);
  if (rawPath === "") {
    return anchor === "" ? null : `c${from.chapterId}--${anchor}`;
  }
  if (!rawPath.toLowerCase().endsWith(".md")) {
    return null;
  }
  const fromDir = dirname(from.relBook);
  const targetId = chapterIds.get(normalize(join(fromDir, rawPath)));
  if (targetId === undefined) {
    return null;
  }
  return anchor === "" ? `c${targetId}` : `c${targetId}--${anchor}`;
}
