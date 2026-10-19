// Build the book as a static website with HonKit-style navigation.
//
// Every written chapter from the book's SUMMARY.md becomes a page in the output
// directory, wrapped in a layout with a fixed sidebar (the SUMMARY tree, the
// current chapter highlighted), a header with previous/next links, and
// previous/next navigation under the content. Intra-book `.md` links and
// `#anchors` are rewritten to the built `.html` files, using the same slug
// rules the linter checks. The book's front page (`readme`, `book/README.md` by
// default) becomes index.html.
//
// Usage: geek-book web [output-dir]

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import type { BookConfig } from "../lib/book-config.js";
import { escapeHtml } from "../adapters/render-html/escape.js";
import { parseSummary } from "../lib/summary.js";
import { substituteContentPlaceholders } from "../lib/content-placeholders.js";
import { MarkedParser } from "../adapters/markdown/marked-parser.js";
import { MermaidRenderer } from "../adapters/diagrams/mermaid-renderer.js";
import { RemoteImageStore } from "../adapters/http/remote-image-store.js";
import { renderChapterBody, type HtmlContext } from "../adapters/render-html/html-renderer.js";
import { sourceToModel, type SourceDeps } from "../application/pipelines/source-to-model.js";
import { assemblePage, stylesheet, headHtml, type NavSlot } from "../adapters/web/page-shell.js";
import { assetHref, outputRelFor, pageHref } from "../adapters/web/paths.js";
import { resolveImagePath } from "../lib/images.js";
import { REMOTE_IMAGE_DIR, RemoteImages } from "../lib/remote-images.js";

function usage(): void {
  process.stderr.write("usage: geek-book web [output-dir]\n");
}

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
 * tree. A remote source points at the copy `remote` fetched into
 * `images/remote/`, so the built site carries its pictures with it. Sources
 * outside the book, and schemes nothing fetches, are left alone.
 */
function imageSrc(
  src: string,
  fromRelBook: string,
  fromOutputRel: string,
  remote: RemoteImages,
  assets: string[],
): string {
  const bookRel = resolveImagePath(src, fromRelBook);
  if (bookRel === null) {
    const fetched = remote.nameFor(src);
    return fetched === null ? src : assetHref(fromOutputRel, path.posix.join(REMOTE_IMAGE_DIR, fetched));
  }
  if (!assets.includes(bookRel)) {
    assets.push(bookRel);
  }
  return assetHref(fromOutputRel, bookRel);
}

export async function main(cfg: BookConfig, args: string[]): Promise<number> {
  if (args.length > 1) {
    usage();
    return 2;
  }
  const outputDir = args[0] ? path.resolve(args[0]) : cfg.outputWeb;

  // The book's own website files, when it names them; say which is missing
  // rather than failing later inside a read.
  for (const [label, file] of [["web.css", cfg.web.css], ["web.head", cfg.web.head], ["web.favicon", cfg.web.favicon]] as const) {
    if (file && !fs.existsSync(file)) {
      process.stderr.write(`geek-book: ${label}: no such file ${path.relative(cfg.root, file)}\n`);
      return 1;
    }
  }

  if (!fs.existsSync(cfg.summary)) {
    process.stderr.write(`geek-book: no SUMMARY.md at ${cfg.summary}\n`);
    return 1;
  }
  const items = parseSummary(fs.readFileSync(cfg.summary, "utf8"));

  const pages = new Map<string, string>();
  const written: { relBook: string; label: string; indent: number; outputRel: string }[] = [];

  for (const item of items) {
    if (item.kind !== "entry" || !item.relBook) {
      continue;
    }
    const mdPath = path.join(cfg.bookDir, item.relBook);
    if (!fs.existsSync(mdPath)) {
      continue;
    }
    const outputRel = outputRelFor(item.relBook, cfg.web.prettyUrls);
    pages.set(item.relBook, outputRel);
    written.push({ relBook: item.relBook, label: item.label ?? item.relBook, indent: item.indent ?? 0, outputRel });
  }

  if (!written.length) {
    process.stderr.write("geek-book: no written chapters in SUMMARY.md\n");
    return 1;
  }

  // Every written chapter's id, the same `c<id>` numbering the print build uses,
  // so a link resolves identically in both editions.
  const idOf = new Map<string, number>();
  written.forEach((chapter, index) => idOf.set(chapter.relBook, index));

  // Keep only sidebar groups that contain a written chapter.
  const navItems: { kind: "group" | "entry"; label: string; relBook?: string; indent?: number }[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === "group") {
      let hasChapter = false;
      for (let j = i + 1; j < items.length && items[j].kind !== "group"; j++) {
        if (pages.has(items[j].relBook ?? "")) {
          hasChapter = true;
          break;
        }
      }
      if (hasChapter) navItems.push({ kind: "group", label: item.title ?? "" });
      continue;
    }
    if (pages.has(item.relBook ?? "")) {
      navItems.push({ kind: "entry", label: item.label ?? "", relBook: item.relBook, indent: item.indent ?? 0 });
    }
  }

  const readers = written.map((chapter, index) => ({
    chapter,
    prev: index > 0 ? written[index - 1] : null,
    next: index + 1 < written.length ? written[index + 1] : null,
  }));

  // A clean build starts from an empty directory. `output.clean: false` writes
  // over what is there instead, so a file the book keeps beside the site — or a
  // preview the reader is looking at — survives. Removed pages then linger.
  if (cfg.outputClean) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
  fs.mkdirSync(path.join(outputDir, "assets"), { recursive: true });
  fs.writeFileSync(path.join(outputDir, "assets", "style.css"), stylesheet(cfg));

  // The favicon is copied next to the stylesheet, so a page links it relatively
  // and the site works under any base path.
  const faviconOutput = cfg.web.favicon ? `assets/${path.basename(cfg.web.favicon)}` : null;
  if (faviconOutput) {
    fs.copyFileSync(cfg.web.favicon, path.join(outputDir, faviconOutput));
  }

  /** A page's source path from the book root, for `{path}` in footer links. */
  const sourcePath = (relBook: string): string =>
    path.relative(cfg.root, path.join(cfg.bookDir, relBook)).split(path.sep).join("/");

  // Remote images are fetched into the site, so a reader needs no other server.
  const remote = new RemoteImages(path.join(outputDir, REMOTE_IMAGE_DIR), {
    timeout: cfg.images.timeout,
    types: cfg.images.types,
  });

  // The one source pipeline, with this edition's ports: the website draws a
  // fence under its own id and embeds the SVG, so the figure name is unused.
  const deps: SourceDeps = {
    markdown: new MarkedParser(cfg.markdown.breaks),
    diagrams: new MermaidRenderer(cfg),
    images: new RemoteImageStore(remote),
    substitute: (source) => substituteContentPlaceholders(cfg, source),
    smartTypography: cfg.markdown.smartTypography,
    bookDir: cfg.bookDir,
    diagramName: (index) => ({ id: `diagram-${index}`, name: `diagram-${index}` }),
  };

  const homeOutputRel = "index.html";
  const head = headHtml(cfg);

  const writePage = (
    outputRel: string,
    title: string,
    content: string,
    slot: (typeof readers)[number] | null,
    source: string,
  ): void => {
    const prev: NavSlot | null = slot?.prev ? { label: slot.prev.label, outputRel: slot.prev.outputRel } : null;
    const next: NavSlot | null = slot?.next ? { label: slot.next.label, outputRel: slot.next.outputRel } : null;
    const html = assemblePage(cfg, {
      title,
      content,
      items: navItems,
      pages,
      activeOutputRel: outputRel,
      homeOutputRel,
      prev,
      next,
      sourcePath: source,
      faviconOutput,
      head,
    });
    const outFile = path.join(outputDir, outputRel);
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, html);
  };

  /** Copy a book-relative asset next to the page that uses it. */
  const copyAsset = (bookRel: string): boolean => {
    const source = path.join(cfg.bookDir, bookRel);
    if (!fs.existsSync(source)) {
      process.stderr.write(`geek-book: missing image ${path.relative(cfg.root, source)}\n`);
      return false;
    }
    const target = path.join(outputDir, bookRel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    return true;
  };

  /**
   * A page body: the shared pipeline, then the links and pictures resolved for
   * where the page sits in the output tree. `copyAsset` puts each book picture
   * the page pointed at beside it.
   */
  const renderPage = async (mdPath: string, relBook: string, outputRel: string): Promise<string | null> => {
    const markdown = fs.readFileSync(mdPath, "utf8");
    const ctx = { chapterId: idOf.get(relBook) ?? written.length, relBook, idOf };
    // Remote images have to be in the output before the page points at them.
    const result = await sourceToModel(markdown, ctx, deps);
    if (!result.ok) {
      // A remote image the build could not fetch: the message says which URL.
      process.stderr.write(`geek-book: ${result.diagnostics[0].message}\n`);
      return null;
    }
    const assets: string[] = [];
    const htmlCtx: HtmlContext = {
      code: cfg.code,
      href: (href) => linkHref(href, relBook, outputRel, pages, cfg.web.prettyUrls),
      src: (src) => imageSrc(src, relBook, outputRel, remote, assets),
    };
    const body = renderChapterBody(result.value, htmlCtx);
    for (const asset of assets) {
      if (!copyAsset(asset)) {
        return null;
      }
    }
    return body;
  };

  // The front page (`cfg.readme`), or a redirect to the first chapter.
  const readme = cfg.readme;
  if (fs.existsSync(readme)) {
    const relBook = path.relative(cfg.bookDir, readme).split(path.sep).join("/");
    const body = await renderPage(readme, relBook, homeOutputRel);
    if (body === null) {
      return 1;
    }
    writePage(homeOutputRel, cfg.title, body, readers[0] ?? null, sourcePath(relBook));
  } else {
    const first = written[0];
    const target = pageHref(homeOutputRel, first.outputRel, cfg.web.prettyUrls);
    const body = `<!DOCTYPE html>\n<html lang="${escapeHtml(cfg.language)}"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${target}"><title>${escapeHtml(cfg.title)}</title></head><body></body></html>`;
    fs.writeFileSync(path.join(outputDir, homeOutputRel), body);
  }

  for (const reader of readers) {
    const { chapter } = reader;
    const mdPath = path.join(cfg.bookDir, chapter.relBook);
    const body = await renderPage(mdPath, chapter.relBook, chapter.outputRel);
    if (body === null) {
      return 1;
    }
    writePage(chapter.outputRel, chapter.label, body, reader, sourcePath(chapter.relBook));
  }

  if (remote.fetched > 0) {
    console.log(`geek-book: fetched ${remote.fetched} remote ${remote.fetched === 1 ? "image" : "images"}`);
  }
  console.log(`geek-book: ${outputDir}/ (${written.length} chapters + index)`);
  return 0;
}
