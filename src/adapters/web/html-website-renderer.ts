// The website renderer adapter: the book's HTML, over `render-html` and the
// page shell.
//
// It implements the application's `WebsiteRenderer` port, so the build use case
// never names an HTML module. Two pure pieces meet here — the chapter body
// (`render-html/html-renderer.ts`) and the page around it (`page-shell.ts`) —
// plus the two small resolvers that place a page's links and pictures, which
// are the web build's own concern and so live here rather than in the domain.

import path from "node:path";
import { resolveImage } from "../../domain/services/resolve-images.js";
import type {
  ChapterBodyRequest,
  PageRequest,
  WebsiteRenderer,
} from "../../application/ports/website-renderer.js";
import { REMOTE_IMAGE_DIR } from "../../application/ports/website-renderer.js";
import type { BookSettings } from "../../application/settings.js";
import { escapeHtml } from "../render-html/escape.js";
import { renderChapterBody, type HtmlContext } from "../render-html/html-renderer.js";
import { assetHref, outputRelFor, pageHref } from "./paths.js";
import { assemblePage, stylesheet } from "./page-shell.js";

/** Resolve a markdown-relative link target to a book-relative path. */
function resolveLocal(fromRelBook: string, hrefPath: string): string {
  const dir = path.posix.dirname(fromRelBook.replace(/\\/g, "/"));
  return path.posix.normalize(path.posix.join(dir, hrefPath));
}

/**
 * Rewrite `path.md` / `path.md#anchor` hrefs to links between the built pages.
 * Resolving the target uses the source path (`fromRelBook`); the href itself is
 * measured from the page's own output path (`fromOutputRel`), which is the
 * directory a browser will actually resolve relative links against. A target
 * that is not a written chapter, or not a `.md` at all, is left as written.
 */
function linkHref(
  href: string,
  fromRelBook: string,
  fromOutputRel: string,
  pages: Map<string, string>,
  prettyUrls: boolean,
): string {
  const hash = href.indexOf("#");
  const rawPath = hash === -1 ? href : href.slice(0, hash);
  const anchor = hash === -1 ? "" : href.slice(hash);
  const lower = rawPath.toLowerCase();
  if (!lower.endsWith(".md") && !lower.endsWith(".md/")) {
    return href;
  }
  const outputRel = pages.get(resolveLocal(fromRelBook, rawPath));
  if (outputRel === undefined) {
    return href; // leave unresolved links untouched
  }
  return `${pageHref(fromOutputRel, outputRel, prettyUrls)}${anchor}`;
}

/**
 * Rewrite an `<img src>` to a path relative to the built page and record the
 * book-relative source path, so the builder can copy the file into the output
 * tree. A remote source points at the copy the store fetched into
 * `images/remote/`, so the built site carries its pictures with it. Sources
 * outside the book, and schemes nothing fetches, are left alone.
 */
function imageSrc(
  src: string,
  fromRelBook: string,
  fromOutputRel: string,
  images: ChapterBodyRequest["images"],
  assets: string[],
): string {
  const bookRel = resolveImage(src, fromRelBook);
  if (bookRel === null) {
    const fetched = images.lookup(src)?.name ?? null;
    return fetched === null ? src : assetHref(fromOutputRel, path.posix.join(REMOTE_IMAGE_DIR, fetched));
  }
  if (!assets.includes(bookRel)) {
    assets.push(bookRel);
  }
  return assetHref(fromOutputRel, bookRel);
}

export class HtmlWebsiteRenderer implements WebsiteRenderer {
  readonly remoteImageDir = REMOTE_IMAGE_DIR;

  outputPath(settings: BookSettings, relBook: string): string {
    return outputRelFor(relBook, settings.web.prettyUrls);
  }

  stylesheet(settings: BookSettings): string {
    return stylesheet(settings);
  }

  chapterBody(request: ChapterBodyRequest): string {
    const { settings, chapter, relBook, outputRel, pages, images, assets } = request;
    const ctx: HtmlContext = {
      code: settings.code,
      href: (href) => linkHref(href, relBook, outputRel, pages, settings.web.prettyUrls),
      src: (src) => imageSrc(src, relBook, outputRel, images, assets),
    };
    return renderChapterBody(chapter, ctx);
  }

  page(request: PageRequest): string {
    return assemblePage(request.settings, {
      title: request.title,
      content: request.content,
      items: [...request.items],
      pages: request.pages,
      activeOutputRel: request.activeOutputRel,
      homeOutputRel: request.homeOutputRel,
      prev: request.prev,
      next: request.next,
      sourcePath: request.sourcePath,
      faviconOutput: request.faviconOutput,
      head: request.head,
    });
  }

  redirectHome(settings: BookSettings, firstOutputRel: string): string {
    const target = pageHref("index.html", firstOutputRel, settings.web.prettyUrls);
    return `<!DOCTYPE html>\n<html lang="${escapeHtml(settings.language)}"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${target}"><title>${escapeHtml(settings.title)}</title></head><body></body></html>`;
  }
}
