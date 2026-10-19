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
// What the pages *look like* is the `WebsiteRenderer` port's business; this use
// case owns the build: the plan, the shared pipeline, copying the pictures and
// writing the files. Every failure is a `Diagnostic`, never a thrown error or a
// line written to a stream.

import { fail, ok, type Diagnostic, type Result } from "../../domain/diagnostics.js";
import type { ChapterContext } from "../../domain/model/chapter.js";
import { basename, dirname, join, relative } from "../../domain/values/posix-path.js";
import { substituteContentPlaceholders } from "../pipelines/content-placeholders.js";
import { sourceToModel, type SourceDeps } from "../pipelines/source-to-model.js";
import type { DiagramRenderer } from "../ports/diagram-renderer.js";
import type { FileSystem } from "../ports/file-system.js";
import type { ImageStore } from "../ports/image-store.js";
import type { Logger } from "../ports/logger.js";
import type { MarkdownParser } from "../ports/markdown-parser.js";
import type { TemplateStore } from "../ports/template-store.js";
import { REMOTE_IMAGE_DIR } from "../ports/website-renderer.js";
import type { WebsiteRenderer } from "../ports/website-renderer.js";
import type { BookSettings } from "../settings.js";
import { planBook } from "./plan-book.js";

/** What a website build needs; the composition root supplies each port. */
export interface BuildWebsiteDeps {
  readonly settings: BookSettings;
  readonly fs: FileSystem;
  readonly templates: TemplateStore;
  readonly renderer: WebsiteRenderer;
  readonly markdown: MarkdownParser;
  readonly diagrams: DiagramRenderer;
  /** Open the remote-image cache rooted at `dir`; `print` refuses formats the PDF cannot embed. */
  readonly openImages: (dir: string, print: boolean) => ImageStore;
  readonly logger: Logger;
}

/** What a finished build reports. */
export interface WebsiteReport {
  /** Written chapters; the home page is index.html and is not counted. */
  readonly chapters: number;
  /** Remote images actually fetched this run. */
  readonly fetched: number;
}

/** One written chapter with its page. */
interface WebChapter {
  readonly relBook: string;
  readonly label: string;
  readonly outputRel: string;
}

export async function buildWebsite(
  deps: BuildWebsiteDeps,
  outputDir: string,
): Promise<Result<WebsiteReport>> {
  const { settings, fs } = deps;

  // The book's own website files, when it names them; say which is missing
  // rather than failing later inside a read.
  for (const [label, file] of [
    ["web.css", settings.web.css],
    ["web.head", settings.web.head],
    ["web.favicon", settings.web.favicon],
  ] as const) {
    if (file && !fs.exists(file)) {
      return fail({
        severity: "error",
        code: "web/missing-file",
        message: `${label}: no such file ${relative(settings.root, file)}`,
      });
    }
  }

  const planned = planBook(fs, settings);
  if (!planned.ok) {
    return planned;
  }
  const { items, chapters, idOf } = planned.value;

  const pages = new Map<string, string>();
  const written: WebChapter[] = chapters.map((chapter) => {
    const outputRel = deps.renderer.outputPath(settings, chapter.relBook);
    pages.set(chapter.relBook, outputRel);
    return { relBook: chapter.relBook, label: chapter.label, outputRel };
  });

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
      if (hasChapter) {
        navItems.push({ kind: "group", label: item.title ?? "" });
      }
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
  if (settings.outputClean) {
    fs.removeTree(outputDir);
  }
  fs.makeDirs(join(outputDir, "assets"));
  fs.writeText(join(outputDir, "assets", "style.css"), deps.renderer.stylesheet(settings));

  // The favicon is copied next to the stylesheet, so a page links it relatively
  // and the site works under any base path.
  const faviconOutput = settings.web.favicon ? `assets/${basename(settings.web.favicon)}` : null;
  if (faviconOutput) {
    fs.copy(settings.web.favicon, join(outputDir, faviconOutput));
  }

  /** A page's source path from the book root, for `{path}` in footer links. */
  const sourcePath = (relBook: string): string => relative(settings.root, join(settings.bookDir, relBook));

  // Remote images are fetched into the site, so a reader needs no other server.
  const images = deps.openImages(join(outputDir, REMOTE_IMAGE_DIR), false);

  // The one source pipeline, with this edition's ports: the website draws a
  // fence under its own id and embeds the SVG, so the figure name is unused.
  const pipeline: SourceDeps = {
    markdown: deps.markdown,
    diagrams: deps.diagrams,
    images,
    substitute: (source) => substituteContentPlaceholders(settings, source),
    smartTypography: settings.markdown.smartTypography,
    bookDir: settings.bookDir,
    diagramName: (index) => ({ id: `diagram-${index}`, name: `diagram-${index}` }),
  };

  const homeOutputRel = "index.html";
  const head = deps.templates.headHtml(settings.web.head);

  /** Copy a book-relative asset next to the page that uses it. */
  const copyAsset = (bookRel: string): Diagnostic | null => {
    const source = join(settings.bookDir, bookRel);
    if (!fs.exists(source)) {
      return {
        severity: "error",
        code: "web/missing-image",
        message: `missing image ${relative(settings.root, source)}`,
      };
    }
    const target = join(outputDir, bookRel);
    fs.makeDirs(dirname(target));
    fs.copy(source, target);
    return null;
  };

  /**
   * A page body: the shared pipeline, then the links and pictures resolved for
   * where the page sits in the output tree. `copyAsset` puts each book picture
   * the page pointed at beside it.
   */
  const renderPage = async (mdPath: string, relBook: string, outputRel: string): Promise<Result<string>> => {
    const markdown = fs.readText(mdPath);
    if (markdown === null) {
      return fail({
        severity: "error",
        code: "web/missing-chapter",
        message: `cannot read ${relative(settings.root, mdPath)}`,
      });
    }
    const ctx: ChapterContext = { chapterId: idOf.get(relBook) ?? written.length, relBook, idOf };
    // Remote images have to be in the output before the page points at them.
    const model = await sourceToModel(markdown, ctx, pipeline);
    if (!model.ok) {
      return model;
    }
    const assets: string[] = [];
    const body = deps.renderer.chapterBody({
      settings,
      chapter: model.value,
      relBook,
      outputRel,
      pages,
      images,
      assets,
    });
    for (const asset of assets) {
      const failure = copyAsset(asset);
      if (failure !== null) {
        return fail(failure);
      }
    }
    return ok(body);
  };

  const writePage = (
    outputRel: string,
    title: string,
    content: string,
    slot: (typeof readers)[number] | null,
    source: string,
  ): void => {
    const prev = slot?.prev ? { label: slot.prev.label, outputRel: slot.prev.outputRel } : null;
    const next = slot?.next ? { label: slot.next.label, outputRel: slot.next.outputRel } : null;
    const html = deps.renderer.page({
      settings,
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
    const outFile = join(outputDir, outputRel);
    fs.makeDirs(dirname(outFile));
    fs.writeText(outFile, html);
  };

  // The front page (`settings.readme`), or a redirect to the first chapter.
  const readme = settings.readme;
  if (fs.exists(readme)) {
    const relBook = relative(settings.bookDir, readme);
    const body = await renderPage(readme, relBook, homeOutputRel);
    if (!body.ok) {
      return body;
    }
    writePage(homeOutputRel, settings.title, body.value, readers[0] ?? null, sourcePath(relBook));
  } else {
    const first = written[0];
    fs.writeText(join(outputDir, homeOutputRel), deps.renderer.redirectHome(settings, first.outputRel));
  }

  for (const reader of readers) {
    const { chapter } = reader;
    const body = await renderPage(join(settings.bookDir, chapter.relBook), chapter.relBook, chapter.outputRel);
    if (!body.ok) {
      return body;
    }
    writePage(chapter.outputRel, chapter.label, body.value, reader, sourcePath(chapter.relBook));
  }

  if (images.fetched > 0) {
    deps.logger.info(`geek-book: fetched ${images.fetched} remote ${images.fetched === 1 ? "image" : "images"}`);
  }
  deps.logger.info(`geek-book: ${outputDir}/ (${written.length} chapters + index)`);
  return ok({ chapters: written.length, fetched: images.fetched });
}
