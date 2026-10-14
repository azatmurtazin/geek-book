// Convert a chapter's Markdown into LaTeX, walking the same marked tokens the
// HTML renderer walks, so heading slugs and link targets land on the ids the
// web build already uses: `c<id>` for the chapter and
// `c<id>--<slug>` for every other heading.
//
// The output echoes the web edition's type scale and code styling: a tinted
// code panel with a hairline border, a callout with a left accent bar, flush
// paragraphs with space between them, and thin grey table rules. On top of that
// the printed edition gets classic running heads. The whole typographic setup
// lives in PREAMBLE, so cli.ts only stitches front matter and chapters together.

import path from "node:path";
import { marked } from "marked";
import type { Token, Tokens } from "marked";
import { slugify } from "../lib/markdown.js";
import { resolveImagePath } from "../lib/images.js";
import type { RemoteImages } from "../lib/remote-images.js";
import { CODE_LABELS } from "../lib/langs.js";
import { CONFIG } from "../lib/book-config.js";
import { substituteContentPlaceholders } from "../lib/content-placeholders.js";
import { tokenizeCode } from "../lib/code-tokens.js";
import { plainText } from "../md-to-html/render.js";
import { preprocessMermaidMd, renderMermaid } from "../diagrams/render.js";

/** Text block of an A4 page with the book's margins: 174mm × 259mm. */
const TEXT_WIDTH_MM = 174;
const TEXT_HEIGHT_MM = 259;

const pxToMm = (px: number): number => (px * 25.4) / 96;

export interface TexContext {
  /** Numeric chapter id (`c0`, `c1`, …) — the ids the web build's links use. */
  chapterId: number;
  /** SUMMARY-relative path, e.g. `chapters/01_data_types/02_strings.md`. */
  relBook: string;
  idOf: Map<string, number>;
  /** TOC indent level: 0 for a part index, 1 for an indented SUMMARY entry. */
  tocDepth?: number;
  /** Plain-text title for the running head (the SUMMARY label). */
  runningTitle?: string;
  /** Images the chapter uses, filled in as the prose is walked. */
  images?: ImageCollector;
  /** Remote images already fetched for this build (see lib/remote-images.ts). */
  remote?: RemoteImages;
}

/** An image a chapter references, collected for the build to copy in. */
export interface ImageAsset {
  /** Source, relative to the book directory, e.g. `images/cover.jpg`. */
  relBook: string;
  /** Name of the copy placed under `figures/`, e.g. `c4-i0.jpg`. */
  name: string;
}

export interface ImageCollector {
  byRelBook: Map<string, string>;
  list: ImageAsset[];
}

export interface Figure {
  /** Output base name: `figures/<name>.svg` / `.pdf`. */
  name: string;
  svg: string;
  widthMm: number;
  heightMm: number;
}

export interface ChapterTex {
  tex: string;
  figures: Figure[];
  images: ImageAsset[];
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

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&nbsp;": "\u00a0",
};

function decodeEntities(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => ENTITIES[m] ?? m);
}

type InlineMode = "body" | "heading";

function renderInline(tokens: Token[], ctx: TexContext, mode: InlineMode): string {
  let out = "";
  for (const token of tokens) {
    switch (token.type) {
      case "text": {
        const t = token as Tokens.Text;
        out += t.tokens?.length ? renderInline(t.tokens, ctx, mode) : texEscape(decodeEntities(t.text));
        break;
      }
      case "escape": {
        out += texEscape((token as Tokens.Escape).text);
        break;
      }
      case "codespan": {
        const text = texEscape((token as Tokens.Codespan).text);
        out += mode === "heading" ? `\\texttt{${text}}` : `\\incode{${text}}`;
        break;
      }
      case "strong":
        out += `\\textbf{${renderInline((token as Tokens.Strong).tokens, ctx, mode)}}`;
        break;
      case "em":
        out += `\\emph{${renderInline((token as Tokens.Em).tokens, ctx, mode)}}`;
        break;
      case "del":
        out += renderInline((token as Tokens.Del).tokens, ctx, mode);
        break;
      case "br":
        out += "\\newline";
        break;
      case "html":
        out += texEscape(decodeEntities((token as Tokens.HTML | Tokens.Tag).text));
        break;
      case "image": {
        out += imageTex(token as Tokens.Image, ctx, false);
        break;
      }
      case "link":
        out += renderLink(token as Tokens.Link, ctx, mode);
        break;
      default:
        out += texEscape(decodeEntities((token as { text?: string }).text ?? ""));
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
function renderLink(token: Tokens.Link, ctx: TexContext, mode: InlineMode): string {
  const inner = renderInline(token.tokens, ctx, mode);
  const href = token.href ?? "";
  const target = resolveLink(href, ctx);
  if (target === null) {
    // Keep `%` out of the URL — TeX's comment character. `&` and `#` pass
    // through \href untouched, which probe builds confirmed.
    return `\\href{${href.replace(/%/g, "\\%")}}{\\uplink{${inner}}}`;
  }
  return `\\hyperref[${target}]{\\uplink{${inner}}}`;
}

function resolveLink(href: string, ctx: TexContext): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return null;
  const hash = href.indexOf("#");
  const rawPath = hash === -1 ? href : href.slice(0, hash);
  const anchor = hash === -1 ? "" : href.slice(hash + 1);
  if (rawPath === "") {
    return anchor === "" ? null : `c${ctx.chapterId}--${anchor}`;
  }
  if (!rawPath.toLowerCase().endsWith(".md")) return null;
  const fromDir = path.posix.dirname(ctx.relBook);
  const targetId = ctx.idOf.get(path.posix.normalize(path.posix.join(fromDir, rawPath)));
  if (targetId === undefined) return null;
  return anchor === "" ? `c${targetId}` : `c${targetId}--${anchor}`;
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

function codePanel(lang: string, code: string): string {
  const label = CODE_LABELS[lang];
  const labelLine = label
    ? `{\\hfill\\fontsize{6}{7}\\selectfont\\ttfamily\\color{codecomment}${texEscape(label)}}\\vspace{0pt}\n`
    : "";
  const body = tokenizeCode(code, lang)
    .map(({ kind, text }) => (kind === "comment" ? `\\cc{${texEscapeCode(text)}}` : texEscapeCode(text)))
    .join("");
  const trimmed = body.endsWith("\n") ? body.slice(0, -1) : body;
  return `\\begin{codebox}\n${labelLine}\\begin{Verbatim}[commandchars=\\\\\\{\\},fontsize=\\fontsize{8.5}{12.75}\\selectfont]\n${trimmed}\n\\end{Verbatim}\n\\end{codebox}`;
}

/**
 * Table matching the printed edition: no outer frame, a heavier rule under the
 * muted header, and a thin grey rule under every body row (including the last).
 * colortbl's `\hline` honours `\arrayrulecolor`, unlike booktabs' rules.
 */
function tableTex(table: Tokens.Table, ctx: TexContext): string {
  const specs = table.align.map((align) => {
    if (align === "center") return ">{\\centering\\arraybackslash}X";
    if (align === "right") return ">{\\raggedleft\\arraybackslash}X";
    if (align === "left") return ">{\\raggedright\\arraybackslash}X";
    return "X";
  });
  const header = table.header
    .map((cell) => `{\\fontsize{7.5}{9}\\selectfont\\color{muted}${renderInline(cell.tokens, ctx, "body")}}`)
    .join(" & ");
  const rows = table.rows.map(
    (row) => `${row.map((cell) => renderInline(cell.tokens, ctx, "body")).join(" & ")} \\\\ \\hline`,
  );
  return [
    "{\\fontsize{9.5}{11.5}\\selectfont\\arrayrulecolor{rule}",
    "\\setlength{\\arrayrulewidth}{0.5pt}%",
    "\\renewcommand{\\arraystretch}{1.3}%",
    `\\begin{tabularx}{\\linewidth}{${specs.join(" ")}}`,
    `${header} \\\\`,
    "\\noalign{\\arrayrulewidth=1.2pt}\\hline\\noalign{\\arrayrulewidth=0.5pt}",
    ...rows,
    "\\end{tabularx}",
    "\\par}",
  ].join("\n");
}

function figureTex(figure: Figure): string {
  const w = figure.widthMm;
  const h = figure.heightMm;
  let opts = "";
  if (w > TEXT_WIDTH_MM || h > TEXT_HEIGHT_MM) {
    const byWidth = w / TEXT_WIDTH_MM;
    const byHeight = h / TEXT_HEIGHT_MM;
    opts = byWidth >= byHeight ? "[width=\\linewidth]" : "[height=\\textheight]";
  }
  return `\\begin{center}\n\\includegraphics${opts}{figures/${figure.name}}\n\\end{center}`;
}

/**
 * Place an image on the page.
 *
 * A photograph is copied into the build's `figures/` directory under a
 * generated name, so the LaTeX never has to spell out a path into the repo (or
 * a file name with characters TeX dislikes). One image per source per chapter
 * is copied; repeats reuse the copy. A remote source was fetched into the same
 * directory before the chapter was rendered. The width and height together with
 * `keepaspectratio` scale any picture — portrait or landscape — to fit inside
 * the text block. An image the web build would not resolve falls back to its
 * alt text, which is also what the book's Markdown says.
 */
function imageTex(token: Tokens.Image, ctx: TexContext, centered: boolean): string {
  const target = registerImage(token.href ?? "", ctx);
  if (target === null) {
    return `\\textit{${texEscape(token.text)}}`;
  }
  const body = `\\includegraphics[width=\\linewidth,height=\\textheight,keepaspectratio]{${target}}`;
  return centered ? `\\begin{center}\n${body}\n\\end{center}` : body;
}

/** The `figures/…` target for an image source, registering the copy to make. */
function registerImage(src: string, ctx: TexContext): string | null {
  const relBook = resolveImagePath(src, ctx.relBook);
  if (relBook === null) {
    // A remote source is already in `figures/` — `collect` fetched it before
    // the chapter was rendered. A scheme nothing fetches (data:, mailto:) has
    // no file, so it falls back to its alt text.
    const fetched = ctx.remote?.nameFor(src) ?? null;
    return fetched === null ? null : `figures/${fetched}`;
  }
  if (!ctx.images) {
    return null;
  }
  const known = ctx.images.byRelBook.get(relBook);
  if (known !== undefined) {
    return `figures/${known}`;
  }
  const ext = path.extname(relBook).toLowerCase() || ".png";
  const name = `c${ctx.chapterId}-i${ctx.images.list.length}${ext}`;
  ctx.images.byRelBook.set(relBook, name);
  ctx.images.list.push({ relBook, name });
  return `figures/${name}`;
}

/** A paragraph holding nothing but an image — the common case for a figure. */
function standaloneImage(tokens: Token[]): Tokens.Image | null {
  let found: Tokens.Image | null = null;
  for (const token of tokens) {
    if (token.type === "image" && found === null) {
      found = token as Tokens.Image;
      continue;
    }
    const text = token as { type?: string; text?: string };
    if (text.type === "space" || (text.text ?? "").trim() === "") {
      continue;
    }
    return null;
  }
  return found;
}

function renderBlocks(
  tokens: Token[],
  ctx: TexContext,
  figures: Map<number, Figure>,
  depth: number,
): string {
  const parts: string[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case "space":
        break;
      case "hr":
        parts.push("\\par\\medskip\\noindent{\\color{rule}\\rule{\\linewidth}{0.5pt}}\\par\\medskip");
        break;
      case "heading": {
        const t = token as Tokens.Heading;
        const title = renderInline(t.tokens, ctx, "heading");
        const command = headingCommand(t.depth);
        if (t.depth === 1) {
          // The chapter label doubles as the destination `#c<id>`; the slug
          // label covers links that name the title heading itself. Indented
          // SUMMARY entries (sections of a part) get TOC indentation, and the
          // running head carries the plain SUMMARY label.
          const toc = ctx.tocDepth ? `[\\hspace{1.4em}${title}]` : "";
          const mark = ctx.runningTitle ? `\n\\markboth{${ctx.runningTitle}}{}` : "";
          parts.push(
            `\\${command}${toc}{${title}}\\label{c${ctx.chapterId}}\\label{c${ctx.chapterId}--${slugify(plainText(t.tokens))}}${mark}`,
          );
        } else {
          parts.push(`\\${command}{${title}}\\label{c${ctx.chapterId}--${slugify(plainText(t.tokens))}}`);
        }
        break;
      }
      case "code": {
        const t = token as Tokens.Code;
        parts.push(codePanel((t.lang ?? "").toLowerCase(), t.text));
        break;
      }
      case "blockquote": {
        const t = token as Tokens.Blockquote;
        parts.push(`\\begin{callout}\n${renderBlocks(t.tokens, ctx, figures, depth)}\n\\end{callout}`);
        break;
      }
      case "list": {
        const t = token as Tokens.List;
        const open = t.ordered ? "\\begin{enumerate}" : "\\begin{itemize}";
        const close = t.ordered ? "\\end{enumerate}" : "\\end{itemize}";
        const start = Number(t.start || 1);
        let head = open;
        if (t.ordered && start > 1) {
          const counter = ["i", "ii", "iii", "iv", "v"][depth] ?? "i";
          head += `\n\\setcounter{enum${counter}}{${start - 1}}`;
        }
        const items = t.items.map((item) => `\\item ${renderBlocks(item.tokens, ctx, figures, depth + 1)}`);
        parts.push(`${head}\n${items.join("\n")}\n${close}`);
        break;
      }
      case "table":
        parts.push(tableTex(token as Tokens.Table, ctx));
        break;
      case "paragraph": {
        const t = token as Tokens.Paragraph;
        const diagram = /^::pe-diagram-(\d+)::$/.exec(t.text.trim());
        if (diagram) {
          const figure = figures.get(Number(diagram[1]));
          if (figure) {
            parts.push(figureTex(figure));
            break;
          }
        }
        const standalone = standaloneImage(t.tokens ?? []);
        if (standalone !== null) {
          parts.push(imageTex(standalone, ctx, true));
          break;
        }
        parts.push(renderInline(t.tokens ?? [], ctx, "body"));
        break;
      }
      case "text": {
        const t = token as Tokens.Text;
        parts.push(t.tokens?.length ? renderInline(t.tokens, ctx, "body") : texEscape(decodeEntities(t.text)));
        break;
      }
      case "html":
        parts.push(texEscape(decodeEntities((token as Tokens.HTML).text)));
        break;
      default:
        break;
    }
  }
  return parts.join("\n\n");
}

/**
 * One chapter: mermaid fences are pulled out first (they become figure
 * placements), the rest walks marked's block tokens into LaTeX.
 */
export async function chapterToTex(source: string, ctx: TexContext): Promise<ChapterTex> {
  const substituted = substituteContentPlaceholders(source);
  // Remote images have to be on disk before the renderer reaches them.
  await ctx.remote?.collect(substituted);
  const { markdown, diagrams } = await preprocessMermaidMd(substituted);
  const images: ImageCollector = { byRelBook: new Map(), list: [] };
  ctx.images = images;
  const figures: Figure[] = [];
  const byIndex = new Map<number, Figure>();
  for (const [index, source] of diagrams) {
    const svg = await renderMermaid(source, `tex-dgm-${ctx.chapterId}-${index}`);
    const viewBox = /viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg);
    const widthMm = viewBox ? pxToMm(Number(viewBox[3])) : TEXT_WIDTH_MM;
    const heightMm = viewBox ? pxToMm(Number(viewBox[4])) : 100;
    const figure: Figure = { name: `c${ctx.chapterId}-d${index}.pdf`, svg, widthMm, heightMm };
    figures.push(figure);
    byIndex.set(index, figure);
  }
  const tokens = marked.lexer(markdown, { gfm: true });
  return { tex: renderBlocks(tokens, ctx, byIndex, 0), figures, images: images.list };
}

/**
 * Everything the document needs before `\begin{document}`: A4 with the web
 * edition's margins, the text and code families the book names (bold text comes
 * from the face the book names for it — for the default Literata that is the
 * variable font's 700 instance, through harfbuzz), the callout and code-panel
 * environments, the heading shapes and spacing of the site's type scale, and
 * the running heads and footers the printed edition carries.
 *
 * Chapter and section numbers are off (`secnumdepth`), like the web edition,
 * but chapters still land in the table of contents. `plain` (chapter openers)
 * drops the running head but keeps the page number; front matter pages use
 * `empty`. `\pecnumberedplain` restores the chapter-opener style once the bare
 * front matter is past.
 */
export const PREAMBLE = String.raw`\documentclass[11pt,a4paper,oneside]{book}
\usepackage[top=19mm,bottom=19mm,left=18mm,right=18mm]{geometry}
\usepackage{fontspec}
\usepackage{microtype}
\setmainfont{${texEscape(CONFIG.fonts.text)}}${CONFIG.fonts.bold ? `[BoldFont={${texEscape(CONFIG.fonts.bold)}}]` : ""}
\setmonofont{${texEscape(CONFIG.fonts.code)}}[Ligatures=NoCommon,Contextuals=NoAlternate]
\usepackage[table]{xcolor}
\usepackage{titlesec}
\usepackage{fancyvrb}
\usepackage{graphicx}
\usepackage{tabularx}
\usepackage{array}
\usepackage{ragged2e}
\usepackage{fancyhdr}
\usepackage[normalem]{ulem}
\usepackage[colorlinks=true,linkcolor=fg,urlcolor=fg,linktoc=all]{hyperref}
\setlength{\headheight}{14.5pt}
\setlength{\headsep}{5mm}
\setlength{\footskip}{9mm}
\setcounter{secnumdepth}{-1}
\setcounter{tocdepth}{0}
\renewcommand{\contentsname}{Table of Contents}

% Body copy: flush paragraphs with a little air between them, matching the
% web edition, which sets no first-line indent.
\setlength{\parindent}{0pt}
\setlength{\parskip}{5pt plus 2pt minus 1pt}

% The web edition sets no text-align, so its prose is ragged-right;
% match it, keeping hyphenation so long inline-code lines still break cleanly.
\AtBeginDocument{\RaggedRight}

% Long inline-code spans leave few breakpoints; give TeX stretch room so it
% breaks lines instead of overflowing the margin.
\tolerance=1500
\emergencystretch=1.5em
\hbadness=2500

% Lists: 1.4em of padding-left on the site, tighter spacing between items.
\makeatletter
\setlength{\leftmargini}{1.4em}
\setlength{\leftmarginii}{1.4em}
\setlength{\leftmarginiii}{1.2em}
\def\@listI{\leftmargin\leftmargini
  \labelwidth\leftmargini \advance\labelwidth-\labelsep
  \topsep 3pt plus 1pt minus 1pt
  \parsep 2pt plus 1pt minus .5pt
  \itemsep \parsep}
\let\@listi\@listI
\def\@listii{\leftmargin\leftmarginii
  \labelwidth\leftmarginii \advance\labelwidth-\labelsep
  \topsep 2pt plus 1pt minus 1pt
  \parsep 1pt plus 1pt minus .5pt
  \itemsep \parsep}
\makeatother

\definecolor{fg}{HTML}{242a37}
\definecolor{muted}{HTML}{667085}
\definecolor{rule}{HTML}{e4e7ec}
\definecolor{codebg}{HTML}{f6f7f9}
\definecolor{codefg}{HTML}{20304c}
\definecolor{codecomment}{HTML}{6b7280}
\definecolor{calloutbg}{HTML}{f8fafc}
\definecolor{calloutborder}{HTML}{cbd5e1}
\definecolor{calloutfg}{HTML}{3b4252}
% \MakeUppercase (table headers, headings) uppercases character tokens
% inside \incode's arguments, including color names — give it aliases.
\definecolor{RULE}{HTML}{e4e7ec}
\definecolor{CODEBG}{HTML}{f6f7f9}
\definecolor{CODEFG}{HTML}{20304c}

\setlength{\fboxrule}{0.5pt}
\setlength{\fboxsep}{1.5pt}
\newcommand{\cc}[1]{\textcolor{codecomment}{#1}}
\newcommand{\incode}[1]{\fcolorbox{rule}{codebg}{\texttt{\color{codefg}#1}}}

% Links are underlined (the print edition underlines with text-decoration);
% colorlinks keeps them from drawing boxes, and the dark link color keeps
% them from turning blue in a monochrome book.
\newcommand{\uplink}[1]{\uline{#1}}

% Callout — the site's blockquote: tinted panel with a left accent bar.
% Built through saveboxes so the body may hold paragraphs, verbatim code, and
% nested panels. The accent bar is a rule sized to the measured panel height
% and set to its left, like CSS's border-left outside the tinted background.
\newsavebox{\pecalloutcontent}
\newsavebox{\pecalloutframe}
\newenvironment{callout}{%
  \par\smallskip
  \setlength{\fboxsep}{7pt}%
  \begin{lrbox}{\pecalloutcontent}%
  \begin{minipage}{\dimexpr\linewidth-3pt-2\fboxsep\relax}%
  \color{calloutfg}%
}{%
  \end{minipage}%
  \end{lrbox}%
  \begin{lrbox}{\pecalloutframe}%
  \colorbox{calloutbg}{\usebox{\pecalloutcontent}}%
  \end{lrbox}%
  \noindent
  \textcolor{calloutborder}{\rule[\dimexpr-\dp\pecalloutframe\relax]{3pt}{\dimexpr\ht\pecalloutframe+\dp\pecalloutframe\relax}}%
  \usebox{\pecalloutframe}%
  \par\smallskip
}

% Code panel — tinted background, hairline border, language label on top.
\newsavebox{\pecodebox}
\newenvironment{codebox}{%
  \par\smallskip
  \setlength{\fboxsep}{7pt}%
  \begin{lrbox}{\pecodebox}%
  \begin{minipage}{\dimexpr\linewidth-2\fboxsep-2\fboxrule\relax}%
  \color{codefg}%
}{%
  \end{minipage}%
  \end{lrbox}%
  \noindent\fcolorbox{rule}{codebg}{\usebox{\pecodebox}}%
  \par\smallskip
}

% Type scale from the site: 20pt chapter and 15pt section, both over a
% tinted rule; sections below stay bold at the sizes the HTML uses. Spacing
% mirrors the CSS margins (1.1rem above a section, 0.4rem below).
\titleformat{\chapter}[block]
  {\normalfont\bfseries\fontsize{20}{24}\selectfont\color{fg}}{}{0pt}{}%
  [\vspace{0.25em}{\color{rule}\titlerule[1.5pt]}]
% The contents page heading is \chapter* and carries no rule.
\titleformat{name=\chapter,numberless}[block]
  {\normalfont\bfseries\fontsize{20}{24}\selectfont\color{fg}}{}{0pt}{}
\titleformat{\section}
  {\normalfont\bfseries\fontsize{15}{18}\selectfont\color{fg}}{}{0pt}{}%
  [\vspace{0.2em}{\color{rule}\titlerule[0.6pt]}]
\titleformat{\subsection}
  {\normalfont\bfseries\fontsize{12.5}{15}\selectfont\color{fg}}{}{0pt}{}
\titleformat{\subsubsection}
  {\normalfont\bfseries\fontsize{11.5}{14}\selectfont\color{fg}}{}{0pt}{}
\titleformat{\paragraph}[block]
  {\normalfont\fontsize{9.5}{12}\selectfont\color{muted}\MakeUppercase}{}{0pt}{}
\titlespacing*{\chapter}{0pt}{0pt}{10pt}
\titlespacing*{\section}{0pt}{13pt}{5pt}
\titlespacing*{\subsection}{0pt}{11pt}{4pt}
\titlespacing*{\subsubsection}{0pt}{10pt}{4pt}
\titlespacing*{\paragraph}{0pt}{8pt}{3pt}

% TOC entries read like the site's: normal-weight ~10pt with dotted leaders
% and a small indent; book.cls's \l@chapter is bold and leaderless.
\makeatletter
\renewcommand*\l@chapter[2]{%
  \vskip 2pt \@plus\p@
  {\fontsize{10}{13}\selectfont\@dottedtocline{0}{1em}{0em}{#1}{#2}}}
\makeatother

% Running heads sit over the hairline rule on every body page: the book title on
% the left, the current chapter on the right. The folio is centered under the
% text block, the same on every page, so the layout reads the same in a one- or
% two-sided print and nothing depends on the page's parity. The version number
% is not printed here — the introduction names the edition instead. Chapter
% openers (plain) drop the head but keep the centered folio; front matter pages
% use empty, and \pecnumberedplain flips plain back once they are past.
\newcommand{\pefolio}{\fontsize{9}{11}\selectfont\color{muted}\thepage}
\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{\fontsize{8.5}{10}\selectfont\color{muted}${texEscape(CONFIG.title)}}
\fancyhead[R]{\fontsize{8.5}{10}\selectfont\color{muted}\leftmark}
\fancyfoot[C]{\pefolio}
\renewcommand{\headrulewidth}{0.4pt}
\renewcommand{\headrule}{\color{rule}\hrule height\headrulewidth width\headwidth}
\renewcommand{\footrulewidth}{0pt}
\makeatletter
\fancypagestyle{plain}{%
  \fancyhf{}%
  \fancyfoot[C]{\pefolio}%
  \renewcommand{\headrulewidth}{0pt}%
  \renewcommand{\footrulewidth}{0pt}%
}
\let\ps@plainnumbered\ps@plain
\let\ps@plain\ps@empty
\newcommand{\pecnumberedplain}{\let\ps@plain\ps@plainnumbered}
\makeatother
\pagestyle{empty}
`;
