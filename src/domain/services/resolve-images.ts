// Where an image `src` points, as both editions read it.
//
// A source is one of three things: a book-root-absolute path
// (`/images/cover.jpg`), a path relative to the file that references it
// (`../../images/cover.jpg`), or an http(s) URL. The first two resolve here to
// a path inside the book, which both editions then treat alike. A URL comes
// back as `null` and is the remote-image store's business (an adapter) — the
// printed edition cannot hotlink, so the build fetches what it needs.
//
// Anything else is refused, `null`: other schemes (data:, file:) have no file
// here, and a path that climbs out of the book has nowhere to land — the web
// build mirrors the book tree into the output directory, and the printed
// edition would be reading a path that leads out of the repository.
//
// Pure: part of `domain/`, imports nothing outside `domain/`.

import { dirname, isAbsolute, join, normalize } from "../values/posix-path.js";

/** True for a source the build has to fetch: an `http(s)` image URL. */
export function isRemoteImage(src: string): boolean {
  return /^https?:\/\//i.test(src.trim());
}

/**
 * Resolve an image `src` to a book-relative path, or `null` when it is not a
 * local file inside the book (remote URLs, data: URIs, paths that climb out).
 */
export function resolveImage(src: string, fromRelBook: string): string | null {
  const clean = src.split("#")[0].split("?")[0].trim();
  if (!clean) {
    return null;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(clean) || clean.startsWith("//")) {
    return null;
  }
  const fromDir = dirname(fromRelBook.replace(/\\/g, "/"));
  const joined = clean.startsWith("/") ? clean.slice(1) : join(fromDir, clean);
  const relBook = normalize(joined);
  if (!relBook || relBook.startsWith("..") || isAbsolute(relBook)) {
    return null;
  }
  return relBook;
}
