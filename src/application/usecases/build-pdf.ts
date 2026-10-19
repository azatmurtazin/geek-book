// Build the whole book as one LaTeX document and compile it to PDF with
// LuaLaTeX.
//
// Chapter order and ids come from the book's SUMMARY.md with the same `c<id>`
// numbering the website build uses, so intra-book links resolve identically.
// Mermaid fences are rendered to SVG and converted to PDF figures with
// rsvg-convert. The compiler runs three passes, filled with the table of
// contents and the cross-references.
//
// What the document *says* is the `LatexRenderer` port's business, the three
// external tools are the `PdfToolchain` port's, and this use case owns the
// build: the plan, the pipeline, the figures, the document and the passes.

import { fail, ok, type Result } from "../../domain/diagnostics.js";
import type { ChapterContext } from "../../domain/model/chapter.js";
import { basename, dirname, extname, join, relative } from "../../domain/values/posix-path.js";
import { substituteContentPlaceholders } from "../pipelines/content-placeholders.js";
import { sourceToModel, type SourceDeps } from "../pipelines/source-to-model.js";
import type { DiagramRenderer } from "../ports/diagram-renderer.js";
import type { FileSystem } from "../ports/file-system.js";
import type { ImageStore } from "../ports/image-store.js";
import type { LatexRenderer } from "../ports/latex-renderer.js";
import type { Logger } from "../ports/logger.js";
import type { MarkdownParser } from "../ports/markdown-parser.js";
import type { PdfToolchain } from "../ports/pdf-toolchain.js";
import type { BookSettings } from "../settings.js";
import { planBook } from "./plan-book.js";

/** What a printed build needs; the composition root supplies each port. */
export interface BuildPdfDeps {
  readonly settings: BookSettings;
  readonly fs: FileSystem;
  readonly latex: LatexRenderer;
  readonly markdown: MarkdownParser;
  readonly diagrams: DiagramRenderer;
  readonly tools: PdfToolchain;
  /** Open the remote-image cache rooted at `dir`; `print` refuses formats the PDF cannot embed. */
  readonly openImages: (dir: string, print: boolean) => ImageStore;
  readonly logger: Logger;
}

/** What a finished build reports. */
export interface PdfReport {
  readonly chapters: number;
  readonly pages: number;
  readonly fetched: number;
}

export async function buildPdf(deps: BuildPdfDeps, outputPdf: string): Promise<Result<PdfReport>> {
  const { settings, fs, tools } = deps;
  const buildDir = dirname(outputPdf);
  // Name every TeX output (.pdf/.log/.aux/.toc) after the finished PDF, so
  // scratch files sit beside it and any output name works.
  const extension = extname(outputPdf);
  const stem = basename(outputPdf);
  const jobname = (extension && stem.endsWith(extension) ? stem.slice(0, -extension.length) : stem) || "book";
  const texFile = join(buildDir, "book.tex");
  const figuresDir = join(buildDir, "figures");

  const planned = planBook(fs, settings);
  if (!planned.ok) {
    return planned;
  }
  const { items, chapters, idOf } = planned.value;
  const chapterOf = new Map(chapters.map((chapter) => [chapter.id, chapter.relBook]));

  fs.makeDirs(figuresDir);
  // Remote images land among the figures they will be embedded as.
  const images = deps.openImages(figuresDir, true);

  // The preamble is derived from the config, and a book's own extra LaTeX is
  // read here: stop early if that file is missing, before any chapter work.
  const preamble = deps.latex.preamble(settings);
  if (!preamble.ok) {
    return preamble;
  }

  const body: string[] = [];
  for (const item of items) {
    if (item.kind === "group") {
      body.push(deps.latex.groupHeading(item.title ?? ""));
      continue;
    }
    if (!item.relBook) {
      continue;
    }
    const chapterId = idOf.get(item.relBook);
    if (chapterId === undefined) {
      continue;
    }
    const markdown = fs.readText(join(settings.bookDir, item.relBook));
    if (markdown === null) {
      continue;
    }
    const ctx: ChapterContext = { chapterId, relBook: item.relBook, idOf };
    const model = await sourceToModel(markdown, ctx, pipeline(deps, ctx, images));
    if (!model.ok) {
      // A remote image the build could not fetch: the message says which URL.
      return model;
    }
    const chapter = model.value;
    body.push(
      deps.latex.chapter(settings, chapter, {
        tocDepth: item.indent && item.indent > 0 ? 1 : 0,
        runningTitle: item.label,
      }),
    );
    for (const figure of chapter.figures) {
      const svgFile = join(figuresDir, figure.name.replace(/\.pdf$/, ".svg"));
      fs.writeText(svgFile, figure.svg);
      const converted = tools.svgToPdf(svgFile, join(figuresDir, figure.name));
      if (!converted.ok) {
        return converted;
      }
    }
    for (const image of chapter.images) {
      const source = join(settings.bookDir, image.relBook);
      if (!fs.exists(source)) {
        return fail({
          severity: "error",
          code: "pdf/missing-image",
          message: `missing image ${relative(settings.root, source)}`,
        });
      }
      fs.copy(source, join(figuresDir, image.name));
    }
  }

  const document = [
    preamble.value,
    "\\begin{document}",
    deps.latex.frontMatter(settings, buildDir),
    "\\pagestyle{fancy}",
    ...body,
    "\\end{document}",
    "",
  ].join("\n\n");
  fs.writeText(texFile, document);

  // Three passes: with no .toc on the first pass the front matter is one page
  // short, so the second pass renders stale page numbers while writing correct
  // ones — the third pass draws the converged table of contents.
  const compiled = tools.compile(buildDir, jobname, ["draft", "draft", "final"]);
  if (!compiled.ok) {
    return compiled;
  }

  const broken = unresolvedRefs(fs.readText(join(buildDir, `${jobname}.log`)) ?? "");
  if (broken.length > 0) {
    const lines = [`${broken.length} link(s) point at a heading the book never labels:`];
    for (const label of broken.slice(0, 20)) {
      lines.push(`  ${label}${labelChapter(label, chapterOf)}`);
    }
    return fail({ severity: "error", code: "pdf/broken-links", message: lines.join("\n") });
  }

  const counted = await tools.pageCount(outputPdf);
  if (!counted.ok) {
    return counted;
  }

  if (images.fetched > 0) {
    deps.logger.info(`geek-book: fetched ${images.fetched} remote ${images.fetched === 1 ? "image" : "images"}`);
  }
  deps.logger.info(`geek-book: ${relative(settings.root, outputPdf)} (${chapters.length} chapters, ${counted.value} pages)`);
  return ok({ chapters: chapters.length, pages: counted.value, fetched: images.fetched });
}

/** The pipeline's ports for the printed edition: drawings become PDF figures. */
function pipeline(deps: BuildPdfDeps, ctx: ChapterContext, images: ImageStore): SourceDeps {
  return {
    markdown: deps.markdown,
    diagrams: deps.diagrams,
    images,
    substitute: (source) => substituteContentPlaceholders(deps.settings, source),
    smartTypography: deps.settings.markdown.smartTypography,
    bookDir: deps.settings.bookDir,
    diagramName: (index) => ({
      id: `tex-dgm-${ctx.chapterId}-${index}`,
      name: `c${ctx.chapterId}-d${index}.pdf`,
    }),
  };
}

/**
 * Labels a `\hyperref` could not resolve, as the last pass's log reports them.
 *
 * A link to a heading whose label is missing is not an error to LaTeX: it sets
 * the text unlinked and warns "Hyper reference `<label>' ... undefined", which
 * leaves a dead link in a PDF that otherwise looks perfect — the failure this
 * model hides. Reading that warning back makes the build stop instead, and it
 * is the one check that compares the anchors `geek-book lint` knows against the
 * ones this builder actually labels.
 */
function unresolvedRefs(log: string): string[] {
  const labels = new Set<string>();
  for (const match of log.matchAll(/Hyper reference `([^']+)' on page /g)) {
    labels.add(match[1]);
  }
  return [...labels];
}

/** ` (chapter/file.md)` for a `c<id>…` label, so the name points at a file. */
function labelChapter(label: string, chapterOf: Map<number, string>): string {
  const id = /^c(\d+)/.exec(label);
  const file = id ? chapterOf.get(Number(id[1])) : undefined;
  return file ? ` (${file})` : "";
}
