// The settings' fallbacks: what a book that says nothing gets.
//
// Kept on its own so the values read as one table, and so the readers
// (`readers.ts`) have a single place to fall back to. The `satisfies` clauses
// check each section against the shape it fills without widening the literal
// types the rest of the engine relies on.

import type { PaperName, TypeConfig } from "../settings.js";
import { DEFAULT_COLORS } from "../../domain/values/palette.js";
import { DEFAULT_FONTS } from "../../domain/values/fonts.js";

/** The largest remote image a build accepts, in bytes (20 MiB). Big enough for
 *  a full-page photograph, small enough that a wrong URL cannot exhaust memory. */
export const DEFAULT_IMAGE_MAX_BYTES = 20 * 1024 * 1024;

export const DEFAULTS = {
  language: "en",
  bookDir: "book",
  webOutput: "build/html",
  pdfOutput: "build/book.pdf",
  docs: ["README.md", "CONTRIBUTING.md"],
  outputClean: true,
  images: { timeout: 30, types: {}, maxBytes: DEFAULT_IMAGE_MAX_BYTES },
  serve: { port: 4000 },
  lint: { proseWidth: 100, tableWidth: 240, diagramWidth: 80 },
  markdown: { smartTypography: false, breaks: false },
  diagrams: { theme: "auto" as const, fontSize: 13 },
  web: { css: "", head: "", baseUrl: "", favicon: "", prettyUrls: false, links: [] },
  fonts: {
    text: DEFAULT_FONTS.text,
    bold: DEFAULT_FONTS.bold,
    code: DEFAULT_FONTS.code,
    web: DEFAULT_FONTS.web,
  },
  tex: {
    geometry: { paper: "a4" as PaperName, top: 19, bottom: 19, left: 18, right: 18 },
    colors: DEFAULT_COLORS,
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
    titlePage: false,
    copyright: "",
    isbn: "",
    preamble: "",
  },
};
