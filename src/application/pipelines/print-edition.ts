// The printed edition's source pipeline.
//
// `build-pdf` walks the book's Markdown through the same `sourceToModel` every
// edition uses; this is the one place that says how the printed edition configures
// it: drawings become `c<id>-d<index>.pdf` figures under a `tex-dgm-` id, and
// placeholders and smart typography follow the book's settings. It is pure —
// the ports come from the use case — so a test can drive a chapter through the
// print pipeline without a build.

import type { ChapterContext } from "../../domain/model/chapter.js";
import { substituteContentPlaceholders } from "./content-placeholders.js";
import type { SourceDeps } from "./source-to-model.js";
import type { DiagramRenderer } from "../ports/diagram-renderer.js";
import type { ImageStore } from "../ports/image-store.js";
import type { MarkdownParser } from "../ports/markdown-parser.js";
import type { BookSettings } from "../settings.js";

/** What the printed edition's pipeline needs; the use case supplies each port. */
export interface PrintPipelineDeps {
  readonly settings: BookSettings;
  readonly markdown: MarkdownParser;
  readonly diagrams: DiagramRenderer;
  readonly images: ImageStore;
}

/** The shared source pipeline configured for the printed edition. */
export function printSourceDeps(deps: PrintPipelineDeps, ctx: ChapterContext): SourceDeps {
  return {
    markdown: deps.markdown,
    diagrams: deps.diagrams,
    images: deps.images,
    substitute: (source) => substituteContentPlaceholders(deps.settings, source),
    smartTypography: deps.settings.markdown.smartTypography,
    bookDir: deps.settings.bookDir,
    diagramName: (index) => ({
      id: `tex-dgm-${ctx.chapterId}-${index}`,
      name: `c${ctx.chapterId}-d${index}.pdf`,
    }),
  };
}
