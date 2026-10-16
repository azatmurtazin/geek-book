// The book's tree written as LaTeX (see ir.ts; parse.ts builds the tree).
//
// This is the only module that spells LaTeX: it escapes text, picks commands and
// environments, measures pictures and lays panels out. It never sees Markdown —
// when the page should read differently the change belongs here, and when the
// book means something else it belongs in parse.ts.

import { imagePixels } from "../lib/image-size.js";
import { tokenizeCode } from "../lib/code-tokens.js";
import { codeLabel } from "../lib/code-meta.js";
import type { BookConfig } from "../lib/book-config.js";
import type {
  Block,
  Chapter,
  Figure,
  HeadingBlock,
  ImageNode,
  ImageRef,
  Inline,
  LinkNode,
  ListBlock,
  TableBlock,
  TableRow,
} from "./ir.js";

/**
 * The text block pictures are measured against: the paper less the configured
 * margins (see book-config.ts), the same geometry preamble.tex sets. A book
 * that changes its page changes what "fits" means with it.
 */
function textWidthMm(cfg: BookConfig) {
  return cfg.tex.geometry.textWidthMm;
}

function textHeightMm(cfg: BookConfig) {
  return cfg.tex.geometry.textHeightMm;
}

/** What a drawing with no viewBox is taken to measure, in the text block's terms. */
function unmeasuredFigureMm(cfg: BookConfig) {
  return { widthMm: textWidthMm(cfg), heightMm: 100 };
}

const pxToMm = (px: number): number => (px * 25.4) / 96;

/** What the serializer needs that the tree does not carry. */
export interface TexOptions {
  /** TOC indent level: 0 for a part index, 1 for an indented SUMMARY entry. */
  tocDepth?: number;
  /** Plain-text title for the running head (the SUMMARY label). */
  runningTitle?: string;
}

/** One chapter's LaTeX body. */
export function chapterTex(cfg: BookConfig, chapter: Chapter, options: TexOptions = {}): string {
  return blocksTex(cfg, chapter.blocks, options, 0);
}

/**
 * Escape prose for LaTeX text mode. Unicode walks through untouched — the
 * engine is Unicode-native — and everything TeX treats specially gets a
 * control sequence, including `|` so cells are safe inside tabulars.
 */
export function texEscape(text: string): string {
  let out = "";
  for (const ch of text) {
    switch (ch) {
      case "\\":
        out += "\\textbackslash{}";
        break;
      case "^":
        out += "\\textasciicircum{}";
        break;
      case "~":
        out += "\\textasciitilde{}";
        break;
      case "|":
        out += "\\textbar{}";
        break;
      case "{":
      case "}":
      case "#":
      case "$":
      case "%":
      case "&":
      case "_":
        out += "\\" + ch;
        break;
      default:
        out += ch;
    }
  }
  return out;
}

/** Escape a code run for fancyvrb's `commandchars=\{\}` verbatim. */
function texEscapeCode(code: string): string {
  let out = "";
  for (const ch of code) {
    if (ch === "\\") out += "\\textbackslash{}";
    else if (ch === "{") out += "\\{";
    else if (ch === "}") out += "\\}";
    else out += ch;
  }
  return out;
}

/** The whole chapter as one LaTeX run, its blocks spaced as the web edition spaces them. */
function blocksTex(cfg: BookConfig, nodes: Block[], options: TexOptions, listDepth: number): string {
  return nodes.map((node) => blockTex(cfg, node, options, listDepth)).join("\n\n");
}

/** `listDepth` counts the lists an item sits inside, which numbers their counters. */
function blockTex(cfg: BookConfig, node: Block, options: TexOptions, listDepth: number): string {
  switch (node.kind) {
    case "rule":
      return "\\par\\medskip\\noindent{\\color{rule}\\rule{\\linewidth}{0.5pt}}\\par\\medskip";
    case "heading":
      return headingTex(cfg, node, options);
    case "paragraph":
      return inlineTex(cfg, node.content, "body");
    case "code":
      return codePanel(cfg, node.lang, node.code);
    case "callout":
      return `\\begin{callout}\n${blocksTex(cfg, node.blocks, options, listDepth)}\n\\end{callout}`;
    case "list":
      return listTex(cfg, node, options, listDepth);
    case "table":
      return tableTex(cfg, node);
    case "figure":
      return figureTex(cfg, node.figure);
    case "image":
      return imageTex(cfg, node, true);
  }
}

/**
 * A heading, with a label for every anchor it carries.
 *
 * On a chapter title the first label doubles as the destination `#c<id>` and the
 * slug label covers links that name the title heading itself; indented SUMMARY
 * entries (sections of a part) get TOC indentation, and the running head carries
 * the plain SUMMARY label.
 */
function headingTex(cfg: BookConfig, node: HeadingBlock, options: TexOptions): string {
  const title = inlineTex(cfg, node.text, "heading");
  const labels = node.anchors.map((anchor) => `\\label{${anchor}}`).join("");
  if (node.depth !== 1) {
    return `\\${headingCommand(node.depth)}{${title}}${labels}`;
  }
  const toc = options.tocDepth ? `[\\hspace{1.4em}${title}]` : "";
  const mark = options.runningTitle ? `\n\\markboth{${texEscape(options.runningTitle)}}{}` : "";
  return `\\${headingCommand(node.depth)}${toc}{${title}}${labels}${mark}`;
}

function headingCommand(depth: number): string {
  switch (depth) {
    case 1:
      return "chapter";
    case 2:
      return "section";
    case 3:
      return "subsection";
    case 4:
      return "subsubsection";
    default:
      return "paragraph";
  }
}

/**
 * A list, numbering it where the Markdown asks for a start other than one.
 *
 * `listDepth` picks the counter to set — `enumi` at the top level, `enumii`
 * within it — which is LaTeX's business, not the tree's.
 */
function listTex(cfg: BookConfig, node: ListBlock, options: TexOptions, listDepth: number): string {
  const open = node.ordered ? "\\begin{enumerate}" : "\\begin{itemize}";
  const close = node.ordered ? "\\end{enumerate}" : "\\end{itemize}";
  let head = open;
  if (node.ordered && node.start > 1) {
    const counter = ["i", "ii", "iii", "iv", "v"][listDepth] ?? "i";
    head += `\n\\setcounter{enum${counter}}{${node.start - 1}}`;
  }
  const items = node.items.map(
    (blocks) => `\\item ${blocksTex(cfg, blocks, options, listDepth + 1)}`,
  );
  return `${head}\n${items.join("\n")}\n${close}`;
}

/**
 * Table matching the printed edition: no outer frame, a heavier rule under the
 * muted header, and a thin grey rule under every body row (including the last).
 * colortbl's `\hline` honours `\arrayrulecolor`, unlike booktabs' rules.
 */
function tableTex(cfg: BookConfig, node: TableBlock): string {
  const specs = node.align.map((align) => {
    if (align === "center") return ">{\\centering\\arraybackslash}X";
    if (align === "right") return ">{\\raggedleft\\arraybackslash}X";
    if (align === "left") return ">{\\raggedright\\arraybackslash}X";
    return "X";
  });
  const header = node.header.map(
    (cell) => `{\\fontsize{7.5}{9}\\selectfont\\color{muted}${inlineTex(cfg, cell, "body")}}`,
  );
  return [
    "{\\fontsize{9.5}{11.5}\\selectfont\\arrayrulecolor{rule}",
    "\\setlength{\\arrayrulewidth}{0.5pt}%",
    "\\renewcommand{\\arraystretch}{1.3}%",
    `\\begin{tabularx}{\\linewidth}{${specs.join(" ")}}`,
    `${header.join(" & ")} \\\\`,
    "\\noalign{\\arrayrulewidth=1.2pt}\\hline\\noalign{\\arrayrulewidth=0.5pt}",
    ...node.rows.map((row) => bodyRowTex(cfg, row)),
    "\\end{tabularx}",
    "\\par}",
  ].join("\n");
}

/** One body row, cells joined and the thin rule every one of them wears. */
function bodyRowTex(cfg: BookConfig, row: TableRow): string {
  return `${row.map((cell) => inlineTex(cfg, cell, "body")).join(" & ")} \\\\ \\hline`;
}

/**
 * A code panel: tinted, hairline border, language label on top, comments in the
 * muted color the web edition gives them.
 */
function codePanel(cfg: BookConfig, lang: string, code: string): string {
  const label = codeLabel(cfg, lang);
  const labelLine = label
    ? `{\\hfill\\fontsize{6}{7}\\selectfont\\ttfamily\\color{codecomment}${texEscape(label)}}\\vspace{0pt}\n`
    : "";
  const body = tokenizeCode(cfg, code, lang)
    .map(({ kind, text }) => (kind === "comment" ? `\\cc{${texEscapeCode(text)}}` : texEscapeCode(text)))
    .join("");
  const trimmed = body.endsWith("\n") ? body.slice(0, -1) : body;
  return `\\begin{codebox}\n${labelLine}\\begin{Verbatim}[commandchars=\\\\\\{\\},fontsize=\\fontsize{8.5}{12.75}\\selectfont]\n${trimmed}\n\\end{Verbatim}\n\\end{codebox}`;
}

/**
 * A drawing, placed at its own size unless it is bigger than the text block.
 *
 * The size comes from the SVG's viewBox, converted from its user units; a
 * drawing with no viewBox to measure is placed as a full-width figure, which is
 * what this builder assumed before it could measure one.
 */
function figureTex(cfg: BookConfig, figure: Figure): string {
  const size = figure.size;
  const widthMm = size ? pxToMm(size.width) : unmeasuredFigureMm(cfg).widthMm;
  const heightMm = size ? pxToMm(size.height) : unmeasuredFigureMm(cfg).heightMm;
  const axis = shrinkAxis(cfg, widthMm, heightMm);
  const opts = axis === null ? "" : axis === "width" ? "[width=\\linewidth]" : "[height=\\textheight]";
  return `\\begin{center}\n\\includegraphics${opts}{figures/${figure.name}}\n\\end{center}`;
}

/**
 * Place a picture on the page.
 *
 * A picture prints at the size the web edition gives it — 96 pixels to the inch,
 * so the guide's 409-pixel bird is 108mm wide — and is scaled down to the text
 * block only when it would not fit, by width or by height, whichever binds
 * first. A picture smaller than the block is therefore never blown up to it:
 * stretching is what pixelates a small drawing, and the two editions then agree
 * on how large a picture is. A picture whose source has no file at all is its
 * alt text, which is also what the book's Markdown says.
 */
function imageTex(cfg: BookConfig, node: ImageNode, centered: boolean): string {
  const ref = node.ref;
  if (ref === null) {
    return `\\textit{${texEscape(node.alt)}}`;
  }
  const body = `\\includegraphics${imageOptions(cfg, ref)}{figures/${ref.name}}`;
  return centered ? `\\begin{center}\n${body}\n\\end{center}` : body;
}

/**
 * The size options for one picture, given the file the build copied.
 *
 * The dimensions come from the file's own header (see lib/image-size.ts); a file
 * this cannot measure — a format it does not read, or one that is not there —
 * falls back to filling the block, which is how the builder placed every picture
 * before measurements existed.
 */
function imageOptions(cfg: BookConfig, ref: ImageRef): string {
  const pixels = imagePixels(ref.file);
  if (pixels === null) {
    return "[width=\\linewidth,height=\\textheight,keepaspectratio]";
  }
  const widthMm = pxToMm(pixels.width);
  const axis = shrinkAxis(cfg, widthMm, pxToMm(pixels.height));
  if (axis === null) {
    return `[width=${widthMm.toFixed(2)}mm]`;
  }
  return axis === "width" ? "[width=\\linewidth]" : "[height=\\textheight]";
}

/**
 * Which way a picture has to shrink to fit the text block, or `null` when it
 * already fits. Width wins a tie, as this builder has always decided.
 */
function shrinkAxis(cfg: BookConfig, widthMm: number, heightMm: number): "width" | "height" | null {
  if (widthMm <= textWidthMm(cfg) && heightMm <= textHeightMm(cfg)) {
    return null;
  }
  return widthMm / textWidthMm(cfg) >= heightMm / textHeightMm(cfg) ? "width" : "height";
}

type InlineMode = "body" | "heading";

/**
 * Inline content as LaTeX.
 *
 * The mode matters for code: a heading is uppercased and measured as a title, so
 * a run inside one is plain `\texttt`, while body text gets the tinted panel
 * code wears in the web edition. It follows the inline content down, so emphasis
 * inside a heading is title code too.
 */
function inlineTex(cfg: BookConfig, nodes: Inline[], mode: InlineMode): string {
  let out = "";
  for (const node of nodes) {
    switch (node.kind) {
      case "text":
        out += texEscape(node.text);
        break;
      case "code":
        out += mode === "heading" ? `\\texttt{${texEscape(node.text)}}` : `\\incode{${texEscape(node.text)}}`;
        break;
      case "strong":
        out += `\\textbf{${inlineTex(cfg, node.content, mode)}}`;
        break;
      case "em":
        out += `\\emph{${inlineTex(cfg, node.content, mode)}}`;
        break;
      case "del":
        out += inlineTex(cfg, node.content, mode);
        break;
      case "break":
        out += "\\newline";
        break;
      case "link":
        out += linkTex(cfg, node, mode);
        break;
      case "image":
        out += imageTex(cfg, node, false);
        break;
    }
  }
  return out;
}

/**
 * External targets become `\href`; intra-book targets become a `\hyperref` to
 * the label the web build's ids already name — same resolution rules (relative
 * `.md` paths, bare `#anchor`), so a link that works on the site works here.
 * Link text is underlined.
 *
 * `\hyperref` and not `\hyperlink`: the latter needs a `\hypertarget` to exist
 * on the page it points at, and this document has none. LuaTeX answers a
 * `\hyperlink` to a name it never saw by writing a destination at the end of
 * the file, so every intra-book link landed on the last page. `\hyperref`
 * reads the anchor out of the previous pass's `.aux`, which resolves links in
 * either direction.
 */
function linkTex(cfg: BookConfig, node: LinkNode, mode: InlineMode): string {
  const inner = `\\uplink{${inlineTex(cfg, node.content, mode)}}`;
  if (node.target !== null) {
    return `\\hyperref[${node.target}]{${inner}}`;
  }
  // Keep `%` out of the URL — TeX's comment character. `&` and `#` pass
  // through \href untouched, which probe builds confirmed.
  return `\\href{${node.href.replace(/%/g, "\\%")}}{${inner}}`;
}
