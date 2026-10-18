// The typefaces a book is set in.
//
// A book names families, never files: the website loads them from a stylesheet,
// and the printed edition asks the system (fontconfig, via LuaLaTeX) for a
// family by name. The engine's Docker image carries the defaults. Pure: no
// imports outside `domain/`.

/** The families a book is set in, by name. */
export interface FontFamilies {
  /** Family the body text, the headings and the diagrams are set in. */
  readonly text: string;
  /** The text font's bold face, as a fontspec declaration (`Family:options`). */
  readonly bold: string;
  /** Family code blocks are set in. */
  readonly code: string;
  /** Webfont stylesheet the website and previews load; empty loads none. */
  readonly web: string;
}

/** The families a book that names none gets, with their webfont stylesheet. */
export const DEFAULT_FONTS: FontFamilies = {
  text: "Literata",
  bold: "Literata:mode=harf;wght=700",
  code: "JetBrains Mono",
  web: "https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400..700;1,7..72,400..700&family=JetBrains+Mono:wght@400;500&display=swap",
};
