// Image references inside the book.
//
// A markdown image carries a source that is either book-root-absolute
// (`/images/cover.jpg`) or relative to the file that references it
// (`../../images/cover.jpg`). Both the website build and the print build
// resolve them through here, so they agree on what a source means and on which
// references are refused.
//
// Anything that climbs out of the book directory is refused — `null`. The web
// build mirrors the book tree into the output directory, so an image outside
// the book has nowhere to land, and the printed edition would be reading a path
// that leads out of the repository.

import path from "node:path";

/**
 * Resolve an image `src` to a book-relative path, or `null` when it is not a
 * local file inside the book (external URLs, data: URIs, paths that climb out).
 */
export function resolveImagePath(src: string, fromRelBook: string): string | null {
  const clean = src.split("#")[0].split("?")[0].trim();
  if (!clean) {
    return null;
  }
  // External targets are left alone: they are the reader's browser's business,
  // and the print build cannot fetch them.
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
