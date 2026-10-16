// Link and image rewriting for the built site.
//
// Chapter `.md` links (with or without an `#anchor`) become relative `.html`
// links between the built pages, and every `<img src>` becomes a path into the
// output tree, so the build can copy the book's own files and the fetched
// remote ones alongside.

import path from "node:path";
import { resolveImagePath } from "../lib/images.js";
import { REMOTE_IMAGE_DIR, type RemoteImages } from "../lib/remote-images.js";

/** Resolve a markdown-relative link target to a book-relative path. */
function resolveLocal(fromRelBook: string, hrefPath: string): string {
  const dir = path.posix.dirname(fromRelBook.replace(/\\/g, "/"));
  return path.posix.normalize(path.posix.join(dir, hrefPath));
}

/** Rewrite `path.md` / `path.md#anchor` hrefs to relative `.html` links. */
export function rewriteLinks(body: string, fromRelBook: string, pages: Map<string, string>): string {
  const fromDir = path.posix.dirname(fromRelBook.replace(/\\/g, "/"));
  return body.replace(/href="([^"#]*)(#[^"]*)?"/g, (whole, rawPath: string, anchor: string) => {
    const href = rawPath.toLowerCase();
    if (!href.endsWith(".md") && !href.endsWith(".md/")) {
      return whole;
    }
    const targetRel = resolveLocal(fromRelBook, rawPath);
    const outputRel = pages.get(targetRel);
    if (outputRel === undefined) {
      return whole; // leave unresolved links untouched
    }
    const rel = path.posix.relative(fromDir, outputRel) || path.posix.basename(outputRel);
    return `href="${rel}${anchor ?? ""}"`;
  });
}

const IMG_RE = /(<img\b[^>]*?\bsrc=")([^"]*)(")/g;

/**
 * Rewrite every `<img src>` to a path relative to the built page and collect
 * the book-relative source paths, so the build can copy the files into the
 * output tree. Remote sources point at the copies `remote` fetched into
 * `images/remote/`, so the built site carries its pictures with it. Sources
 * outside the book, and schemes nothing fetches, are left alone.
 */
export function rewriteImages(
  body: string,
  fromRelBook: string,
  fromOutputRel: string,
  remote?: RemoteImages,
): { body: string; assets: string[] } {
  const assets: string[] = [];
  const fromDir = path.posix.dirname(fromOutputRel.replace(/\\/g, "/"));
  const out = body.replace(IMG_RE, (whole, prefix: string, src: string, suffix: string) => {
    const bookRel = resolveImagePath(src, fromRelBook);
    if (bookRel === null) {
      const fetched = remote?.nameFor(src) ?? null;
      if (fetched === null) {
        return whole;
      }
      const rel = path.posix.relative(fromDir, path.posix.join(REMOTE_IMAGE_DIR, fetched));
      return `${prefix}${rel || fetched}${suffix}`;
    }
    if (!assets.includes(bookRel)) {
      assets.push(bookRel);
    }
    const rel = path.posix.relative(fromDir, bookRel) || path.posix.basename(bookRel);
    return `${prefix}${rel}${suffix}`;
  });
  return { body: out, assets };
}
