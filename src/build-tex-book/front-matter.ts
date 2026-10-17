// The printed edition's front matter: what stands before the table of contents.
//
// An optional cover image, an optional typographic title page, and an optional
// imprint page carrying the copyright and ISBN the config names, plus a
// colophon naming the typefaces. The whole block is emitted under the empty page
// style, so the front matter carries no running head or folio; the build
// restores the fancy style once the contents are past.
//
// It sits apart from the serializer (tex.ts) because the walk does not write it;
// it is the same LaTeX on every build.

import fs from "node:fs";
import path from "node:path";
import type { BookConfig } from "../lib/book-config.js";
import { texEscape } from "./escape.js";

/** The cover image page, or "" when the book has no cover. */
function coverPage(cfg: BookConfig, buildDir: string): string {
  if (!fs.existsSync(cfg.cover)) return "";
  const relative = path.relative(buildDir, cfg.cover).split(path.sep).join("/");
  const target = relative.startsWith("..") || path.isAbsolute(relative) ? relative : `./${relative}`;
  return [
    "\\noindent\\includegraphics[width=\\linewidth,height=\\textheight,keepaspectratio]{" + target + "}",
    "\\clearpage",
  ].join("\n");
}

/** A typographic title page: the title, the tagline and the author. */
function titlePage(cfg: BookConfig): string {
  const lines = [
    "\\begin{titlepage}",
    "\\centering",
    "\\vspace*{0.2\\textheight}",
    `{\\fontsize{30}{36}\\selectfont\\bfseries\\color{fg} ${texEscape(cfg.title)}\\par}`,
  ];
  if (cfg.tagline) {
    lines.push(
      "\\vspace{1.2em}",
      `{\\fontsize{13}{17}\\selectfont\\color{muted} ${texEscape(cfg.tagline)}\\par}`,
    );
  }
  if (cfg.author) {
    lines.push(
      "\\vfill",
      `{\\fontsize{12}{15}\\selectfont ${texEscape(cfg.author)}\\par}`,
      "\\vspace*{0.1\\textheight}",
    );
  }
  lines.push("\\end{titlepage}");
  return lines.join("\n");
}

/**
 * The imprint page: the copyright line, the ISBN and the typeface colophon,
 * set small and grey near the foot of the page. "" when the book names neither
 * a copyright nor an ISBN, so a book that wants neither gets no page.
 */
function imprintPage(cfg: BookConfig): string {
  const copyright = cfg.tex.copyright;
  const isbn = cfg.tex.isbn;
  if (!copyright && !isbn) return "";
  const lines: string[] = [
    "\\thispagestyle{empty}",
    "\\null\\vfill",
    "{\\fontsize{8.5}{11.5}\\selectfont\\color{muted}",
  ];
  if (copyright) lines.push(`${texEscape(copyright)}\\par`);
  if (isbn) {
    if (copyright) lines.push("\\vspace{0.7em}");
    lines.push(`ISBN ${texEscape(isbn)}\\par`);
  }
  lines.push(
    "\\vspace{0.7em}",
    `Set in ${texEscape(cfg.fonts.text)} and ${texEscape(cfg.fonts.code)}.\\par`,
    "}",
    "\\clearpage",
  );
  return lines.join("\n");
}

/** Everything before the table of contents: the cover, the title and imprint
 *  pages, and the contents itself, with the page style restored after it. */
export function frontMatterTex(cfg: BookConfig, buildDir: string): string {
  const parts = ["\\pagestyle{empty}"];
  const cover = coverPage(cfg, buildDir);
  if (cover) parts.push(cover);
  if (cfg.tex.titlePage) parts.push(titlePage(cfg));
  const imprint = imprintPage(cfg);
  if (imprint) parts.push(imprint);
  parts.push("\\tableofcontents", "\\clearpage", "\\pecnumberedplain");
  return parts.join("\n\n");
}
