// The LaTeX renderer adapter: the printed edition's document, over the
// serializer, the preamble and the front matter.
//
// It implements the application's `LatexRenderer` port. The serializer
// (`build-tex-book/tex.ts`) is pure over the model; the preamble and the front
// matter read the book's own files, so those two live here and answer with a
// failure rather than a throw when a named file is missing.

import fs from "node:fs";
import { fail, ok, type Result } from "../../domain/diagnostics.js";
import { relative } from "../../domain/values/posix-path.js";
import { frontMatterTex } from "../../build-tex-book/front-matter.js";
import { preambleTex } from "../../build-tex-book/preamble.js";
import { chapterTex, texEscape } from "../../build-tex-book/tex.js";
import type { Chapter } from "../../domain/model/chapter.js";
import type { BookSettings } from "../../application/settings.js";
import type { ChapterTexOptions, LatexRenderer } from "../../application/ports/latex-renderer.js";

export class SystemLatexRenderer implements LatexRenderer {
  preamble(settings: BookSettings): Result<string> {
    if (settings.tex.preamble && !fs.existsSync(settings.tex.preamble)) {
      return fail({
        severity: "error",
        code: "pdf/missing-preamble",
        message: `the tex.preamble file is missing: ${relative(settings.root, settings.tex.preamble)}`,
      });
    }
    return ok(preambleTex(settings));
  }

  frontMatter(settings: BookSettings, buildDir: string): string {
    return frontMatterTex(settings, buildDir);
  }

  chapter(settings: BookSettings, chapter: Chapter, options: ChapterTexOptions = {}): string {
    return chapterTex(settings, chapter, options);
  }

  groupHeading(title: string): string {
    return `\\addtocontents{toc}{\\protect\\vspace{15.4pt}\\protect\\noindent{\\protect\\fontsize{8.6}{11}\\selectfont\\protect\\bfseries\\protect\\color{muted}\\MakeUppercase{${texEscape(title)}}\\par}}`;
  }
}
