// The printed edition's palette: the colour keys a book may set, and the engine's
// own defaults. The website derives its palette from the same keys, so the two
// editions cannot drift. Pure: no imports outside `domain/`.

/** The printed edition's palette, each value `#rrggbb`. */
export type ColorKey =
  | "fg"
  | "muted"
  | "rule"
  | "codeBackground"
  | "codeForeground"
  | "codeComment"
  | "calloutBackground"
  | "calloutBorder"
  | "calloutForeground";

export type ColorsConfig = Record<ColorKey, string>;

/** The palette a book that says nothing gets. */
export const DEFAULT_COLORS: ColorsConfig = {
  fg: "#242a37",
  muted: "#667085",
  rule: "#e4e7ec",
  codeBackground: "#f6f7f9",
  codeForeground: "#20304c",
  codeComment: "#6b7280",
  calloutBackground: "#f8fafc",
  calloutBorder: "#cbd5e1",
  calloutForeground: "#3b4252",
};
