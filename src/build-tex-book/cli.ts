// Build the whole book as one LaTeX document and compile it to PDF with
// LuaLaTeX.
//
// Chapter order and ids come from the book's SUMMARY.md with the same `c<id>`
// numbering the web build uses, so intra-book links resolve identically.
// Mermaid fences are rendered to SVG and converted to PDF figures with
// rsvg-convert. Two compiler passes fill the table of contents and resolve
// links.
//
// Usage: geek-book pdf [output.pdf]

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { BOOK, COVER, SUMMARY } from "../lint/paths.js";
import { CONFIG } from "../lib/book-config.js";
import { parseSummary } from "../lib/summary.js";
import { pdfPages } from "../pdf-info/pdf.js";
import { PREAMBLE, chapterToTex, texEscape, type TexContext } from "./tex.js";

/** Absolute locations for tools that macOS may not put on a non-login PATH. */
const TOOL_FALLBACKS: Record<string, string[]> = {
  lualatex: ["/Library/TeX/texbin/lualatex", "/usr/local/texlive/bin/universal-darwin/lualatex"],
  "rsvg-convert": ["/usr/local/bin/rsvg-convert", "/opt/homebrew/bin/rsvg-convert"],
};

function usage(): void {
  process.stderr.write("usage: geek-book pdf [output.pdf]\n");
}

function runTool(command: string, args: string[], options: { cwd?: string; logFile?: string }): string | null {
  const attempts = [command, ...(TOOL_FALLBACKS[command] ?? [])];
  let lastMissing = command;
  for (const bin of attempts) {
    const result = spawnSync(bin, args, { ...options, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    if (result.error) {
      if ((result.error as NodeJS.ErrnoException).code === "ENOENT") {
        lastMissing = bin;
        continue;
      }
      throw result.error;
    }
    if (result.status === 0) return null;
    if (options.logFile && fs.existsSync(options.logFile)) return tailOf(options.logFile);
    return (result.stderr ?? "").trim() || `${bin} exited with status ${result.status}`;
  }
  const hint =
    lastMissing === "lualatex"
      ? "lualatex: not found — install MacTeX or TeX Live"
      : `${lastMissing}: not found — install it (brew install librsvg)`;
  throw new Error(hint);
}

function tailOf(file: string): string {
  const lines = fs.readFileSync(file, "utf8").split("\n").filter((line) => line.trim() !== "");
  return lines.slice(-25).join("\n");
}

function coverInclude(buildDir: string): string {
  if (!fs.existsSync(COVER)) return "";
  const relative = path.relative(buildDir, COVER).split(path.sep).join("/");
  const target = relative.startsWith("..") || path.isAbsolute(relative) ? relative : `./${relative}`;
  return [
    "\\noindent\\includegraphics[width=\\linewidth,height=\\textheight,keepaspectratio]{" + target + "}",
    "\\clearpage",
  ].join("\n");
}

export async function main(args: string[]): Promise<number> {
  if (args.length > 1) {
    usage();
    return 2;
  }
  const outputPdf = args[0] ? path.resolve(args[0]) : CONFIG.outputPdf;
  const buildDir = path.dirname(outputPdf);
  // Name every TeX output (.pdf/.log/.aux/.toc) after the finished PDF, so
  // scratch files sit beside it and any output name works.
  const jobname = path.basename(outputPdf, path.extname(outputPdf)) || "book";
  const texFile = path.join(buildDir, "book.tex");
  const figuresDir = path.join(buildDir, "figures");

  if (!fs.existsSync(SUMMARY)) {
    process.stderr.write(`geek-book: no SUMMARY.md at ${SUMMARY}\n`);
    return 1;
  }
  const items = parseSummary(fs.readFileSync(SUMMARY, "utf8"));

  const idOf = new Map<string, number>();
  let chapterCount = 0;
  for (const item of items) {
    if (item.kind !== "entry" || !item.relBook || !fs.existsSync(path.join(BOOK, item.relBook))) continue;
    idOf.set(item.relBook, chapterCount);
    chapterCount++;
  }
  if (chapterCount === 0) {
    process.stderr.write("geek-book: no written chapters in SUMMARY.md\n");
    return 1;
  }

  fs.mkdirSync(figuresDir, { recursive: true });

  const body: string[] = [];
  for (const item of items) {
    if (item.kind === "group") {
      body.push(
        `\\addtocontents{toc}{\\protect\\vspace{15.4pt}\\protect\\noindent{\\protect\\fontsize{8.6}{11}\\selectfont\\protect\\bfseries\\protect\\color{muted}\\MakeUppercase{${texEscape(item.title ?? "")}}\\par}}`,
      );
      continue;
    }
    if (!item.relBook) continue;
    const chapterId = idOf.get(item.relBook);
    if (chapterId === undefined) continue;
    const ctx: TexContext = {
      chapterId,
      relBook: item.relBook,
      idOf,
      tocDepth: item.indent && item.indent > 0 ? 1 : 0,
      runningTitle: item.label ? texEscape(item.label) : undefined,
    };
    const { tex, figures, images } = await chapterToTex(fs.readFileSync(path.join(BOOK, item.relBook), "utf8"), ctx);
    for (const figure of figures) {
      const svgFile = path.join(figuresDir, figure.name.replace(/\.pdf$/, ".svg"));
      fs.writeFileSync(svgFile, figure.svg);
      const failure = runTool("rsvg-convert", ["-f", "pdf", "-o", path.join(figuresDir, figure.name), svgFile], {});
      if (failure !== null) {
        process.stderr.write(`geek-book: rsvg-convert failed for ${figure.name}:\n${failure}\n`);
        return 1;
      }
    }
    for (const image of images) {
      const source = path.join(BOOK, image.relBook);
      if (!fs.existsSync(source)) {
        process.stderr.write(`geek-book: missing image ${path.relative(CONFIG.root, source)}\n`);
        return 1;
      }
      fs.copyFileSync(source, path.join(figuresDir, image.name));
    }
    body.push(tex);
  }

  const document = [
    PREAMBLE.trimEnd(),
    "\\begin{document}",
    // Front matter (cover, contents) is bare; \pecnumberedplain restores the
    // chapter-opener page style once the contents are past.
    "\\pagestyle{empty}",
    coverInclude(buildDir),
    "\\tableofcontents",
    "\\clearpage",
    "\\pecnumberedplain",
    "\\pagestyle{fancy}",
    ...body,
    "\\end{document}",
    "",
  ].join("\n\n");
  fs.writeFileSync(texFile, document);

  const baseArgs = ["-interaction=nonstopmode", "-halt-on-error", "-file-line-error", `-jobname=${jobname}`];
  const logFile = path.join(buildDir, `${jobname}.log`);
  // Three passes: with no .toc on the first pass the front matter is one
  // page short, so the second pass renders stale page numbers while writing
  // correct ones — the third pass draws the converged table of contents.
  const passes = ["-draftmode", "-draftmode", ""];
  for (const [index, mode] of passes.entries()) {
    const args = [...baseArgs, ...(mode ? [mode] : []), "book.tex"];
    const failure = runTool("lualatex", args, { cwd: buildDir, logFile });
    if (failure !== null) {
      process.stderr.write(`geek-book: lualatex pass ${index + 1} failed:\n${failure}\n`);
      return 1;
    }
  }
  const pages = await pdfPages(outputPdf);
  console.log(`geek-book: ${path.relative(CONFIG.root, outputPdf)} (${chapterCount} chapters, ${pages} pages)`);
  return 0;
}
