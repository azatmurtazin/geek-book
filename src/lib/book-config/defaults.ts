// The config's fallbacks: what a book that says nothing gets.
//
// Kept on its own so the values read as one table, and so the readers
// (`validators.ts`) have a single place to fall back to. The `satisfies` clauses
// check each section against the shape it fills without widening the literal
// types the rest of the engine relies on.

import type { ColorsConfig, PaperName, TypeConfig } from "./types.js";

export const DEFAULTS = {
  language: "en",
  bookDir: "book",
  webOutput: "build/html",
  pdfOutput: "build/book.pdf",
  docs: ["README.md", "CONTRIBUTING.md"],
  outputClean: true,
  images: { timeout: 30, types: {} },
  serve: { port: 4000 },
  lint: { proseWidth: 100, tableWidth: 240, diagramWidth: 80 },
  markdown: { smartTypography: false },
  web: { css: "", head: "", baseUrl: "", favicon: "", links: [] },
  fonts: {
    text: "Literata",
    bold: "Literata:mode=harf;wght=700",
    code: "JetBrains Mono",
    web: "https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400..700;1,7..72,400..700&family=JetBrains+Mono:wght@400;500&display=swap",
  },
  tex: {
    geometry: { paper: "a4" as PaperName, top: 19, bottom: 19, left: 18, right: 18 },
    colors: {
      fg: "#242a37",
      muted: "#667085",
      rule: "#e4e7ec",
      codeBackground: "#f6f7f9",
      codeForeground: "#20304c",
      codeComment: "#6b7280",
      calloutBackground: "#f8fafc",
      calloutBorder: "#cbd5e1",
      calloutForeground: "#3b4252",
    } satisfies ColorsConfig,
    type: {
      base: 11,
      chapter: 20,
      section: 15,
      subsection: 12.5,
      subsubsection: 11.5,
      paragraph: 9.5,
    } satisfies TypeConfig,
    class: "book",
    side: "oneside" as const,
    tocDepth: 0,
    preamble: "",
  },
};
