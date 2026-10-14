// The document preamble: the plain-LaTeX half of the printed edition.
//
// It sits apart from the serializer (tex.ts) because the walk does not write it
// — it is the same LaTeX on every build and reads as LaTeX. The text block its
// geometry sets is the one tex.ts measures pictures against.

import { CONFIG } from "../lib/book-config.js";
import { texEscape } from "./tex.js";

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
