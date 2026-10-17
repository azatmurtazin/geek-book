// Where a chapter's page lands in the output tree, and how one built page links
// to another.
//
// The default naming writes `chapters/01_writing/01_tree.md` as
// `chapters/01_writing/01_tree.html`. `web.prettyUrls` writes it as
// `chapters/01_writing/01_tree/index.html` instead, so the URL carries no
// extension and a static host serves its own directory index. The home page is
// the root's `index.html` under either scheme, which is already that shape.
//
// Linking follows the naming, and the two halves have to agree: a href that
// named a directory while the output still held `.html` files would 404, and
// one that named the file while the output held directories would ask for a
// path no host would resolve. So a target's trailing `index.html` is dropped
// exactly when the output wrote directories.
//
// Every href here is relative to the page doing the linking — its *output*
// path, never its source file's directory, which under pretty URLs sits a level
// above the page that renders it. Assets (the stylesheet, the favicon, the
// images) are plain files under both schemes, so `assetHref` is the plain
// relative and `pageHref` is `assetHref` with the directory form applied.

import path from "node:path";

/** Where a chapter's page is written, relative to the output root. */
export function outputRelFor(relBook: string, prettyUrls: boolean): string {
  const name = relBook.replace(/\.md$/i, "");
  return prettyUrls ? `${name}/index.html` : `${name}.html`;
}

/** A relative href from one output path to another, for a plain file. */
export function assetHref(fromOutputRel: string, toOutputRel: string): string {
  const from = fromOutputRel.replace(/\\/g, "/");
  const rel = path.posix.relative(path.posix.dirname(from), toOutputRel);
  return rel || path.posix.basename(toOutputRel);
}

/**
 * A relative href from one built page to another. With `prettyUrls` the
 * target's `index.html` becomes the directory itself, so the browser asks for
 * the URL the book actually names. A page linking to itself is "./", the only
 * relative path that neither spelling would write as an empty href.
 */
export function pageHref(fromOutputRel: string, toOutputRel: string, prettyUrls: boolean): string {
  const rel = assetHref(fromOutputRel, toOutputRel);
  if (!prettyUrls) return rel;
  if (rel === "index.html") return "./";
  if (rel.endsWith("/index.html")) return rel.slice(0, -"index.html".length);
  return rel;
}
