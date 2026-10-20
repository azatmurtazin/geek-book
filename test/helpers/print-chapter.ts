// A chapter's Markdown through the printed edition's pipeline, for tests.
//
// `printChapter` is the full path `buildPdf` runs — the `marked` parser, the
// Mermaid renderer and no remote cache — and `walkMarkdown` is the pure middle
// of it: the tree the walk builds when a chapter has nothing to fetch or draw.
// Both stand in for the deleted `build-tex-book/parse.ts`, wired the way the
// use case wires its ports.

import { MermaidRenderer } from "../../src/adapters/diagrams/mermaid-renderer.js";
import { NoRemoteImages } from "../../src/adapters/http/remote-images.js";
import { MarkedParser } from "../../src/adapters/markdown/marked-parser.js";
import { substituteContentPlaceholders } from "../../src/application/pipelines/content-placeholders.js";
import { printSourceDeps } from "../../src/application/pipelines/print-edition.js";
import { sourceToModel } from "../../src/application/pipelines/source-to-model.js";
import type { BookSettings } from "../../src/application/settings.js";
import type { Chapter, ChapterContext } from "../../src/domain/model/chapter.js";
import { assemble } from "../../src/domain/services/assemble.js";

const parser = new MarkedParser();

/**
 * The pure middle of {@link printChapter}: a chapter's tree, with no I/O.
 *
 * The Markdown is what a walk sees — placeholders filled, but mermaid fences
 * still in place. A chapter carrying one therefore goes through
 * `printChapter`, which draws them first so the walk can resolve them.
 */
export function walkMarkdown(
  settings: BookSettings,
  markdown: string,
  ctx: ChapterContext,
): Chapter {
  const nodes = parser.lex(substituteContentPlaceholders(settings, markdown));
  return assemble(nodes, ctx, {
    bookDir: settings.bookDir,
    smartTypography: settings.markdown.smartTypography,
  });
}

/** One chapter as a tree, with the files its build has to prepare. */
export async function printChapter(
  settings: BookSettings,
  source: string,
  ctx: ChapterContext,
): Promise<Chapter> {
  const result = await sourceToModel(
    source,
    ctx,
    printSourceDeps(
      {
        settings,
        markdown: parser,
        diagrams: new MermaidRenderer(settings),
        images: new NoRemoteImages(),
      },
      ctx,
    ),
  );
  if (!result.ok) {
    throw new Error(result.diagnostics[0].message);
  }
  return result.value;
}
