// Link and image rewriting for the built site.
//
// Chapter `.md` links (with or without an `#anchor`) become relative `.html`
// links between the built pages, and every `<img src>` becomes a path into the
// output tree, so the build can copy the book's own files and the fetched
// remote ones alongside.

import path from "node:path";
import { resolveImagePath } from "../lib/images.js";
import { REMOTE_IMAGE_DIR, type RemoteImages } from "../lib/remote-images.js";
import { assetHref, pageHref } from "./paths.js";

/** Resolve a markdown-relative link target to a book-relative path. */
function resolveLocal(fromRelBook: string, hrefPath: string): string {
  const dir = path.posix.dirname(fromRelBook.replace(/\\/g, "/"));
  return path.posix.normalize(path.posix.join(dir, hrefPath));
}

/**
 * Rewrite `path.md` / `path.md#anchor` hrefs to links between the built pages.
 * Resolving the target uses the source path (`fromRelBook`); the href itself is
 * measured from the page's own output path (`fromOutputRel`), which is the
 * directory a browser will actually resolve relative links against.
 */
export function rewriteLinks(
  body: string,
  fromRelBook: string,
  fromOutputRel: string,
  pages: Map<string, string>,
  prettyUrls: boolean,
): string {
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
    return `href="${pageHref(fromOutputRel, outputRel, prettyUrls)}${anchor ?? ""}"`;
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
  const out = body.replace(IMG_RE, (whole, prefix: string, src: string, suffix: string) => {
    const bookRel = resolveImagePath(src, fromRelBook);
    if (bookRel === null) {
      const fetched = remote?.nameFor(src) ?? null;
      if (fetched === null) {
        return whole;
      }
      return `${prefix}${assetHref(fromOutputRel, path.posix.join(REMOTE_IMAGE_DIR, fetched))}${suffix}`;
    }
    if (!assets.includes(bookRel)) {
      assets.push(bookRel);
    }
    return `${prefix}${assetHref(fromOutputRel, bookRel)}${suffix}`;
  });
  return { body: out, assets };
}
