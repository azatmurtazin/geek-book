// Where an image `src` points, as both editions read it.
//
// A source is one of three things: a book-root-absolute path
// (`/images/cover.jpg`), a path relative to the file that references it
// (`../../images/cover.jpg`), or an http(s) URL. The first two resolve here to
// a path inside the book, which both editions then treat alike. A URL comes
// back as `null` and is the remote-image cache's business
// (src/lib/remote-images.ts) — the printed edition cannot hotlink, so the build
// fetches what it needs.
//
// Anything else is refused, `null`: other schemes (data:, file:) have no file
// here, and a path that climbs out of the book has nowhere to land — the web
// build mirrors the book tree into the output directory, and the printed
// edition would be reading a path that leads out of the repository.

import path from "node:path";

/** True for a source the build has to fetch: an `http(s)` image URL. */
export function isRemoteImage(src: string): boolean {
  return /^https?:\/\//i.test(src.trim());
}

/**
 * Resolve an image `src` to a book-relative path, or `null` when it is not a
 * local file inside the book (remote URLs, data: URIs, paths that climb out).
 */
export function resolveImagePath(src: string, fromRelBook: string): string | null {
  const clean = src.split("#")[0].split("?")[0].trim();
  if (!clean) {
    return null;
  }
  // Remote sources are fetched into the build directory before rendering
  // (src/lib/remote-images.ts); a scheme nothing fetches is left as it is.
  if (/^[a-z][a-z0-9+.-]*:/i.test(clean) || clean.startsWith("//")) {
    return null;
  }
  const fromDir = path.posix.dirname(fromRelBook.replace(/\\/g, "/"));
  const joined = clean.startsWith("/") ? clean.slice(1) : path.posix.join(fromDir, clean);
  const relBook = path.posix.normalize(joined);
  if (!relBook || relBook.startsWith("..") || path.posix.isAbsolute(relBook)) {
    return null;
  }
  return relBook;
}
