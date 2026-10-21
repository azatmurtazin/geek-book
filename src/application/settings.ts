// The shapes a book's settings take, and the paper table they name.
//
// `BookSettings` is the one the rest of the engine sees; the other interfaces
// describe the sections it is assembled from. Nothing here reads or defaults
// anything — that is `settings/readers.ts` and `settings/defaults.ts`, applied
// by the pure `usecases/load-settings.ts`.
//
// The pure values — the paper table, the palette, the code-language rules and
// the font families — live in `domain/values/` and are re-exported here, so
// importers keep naming `settings.js`.

import type { CodeLanguage } from "../domain/values/code-language.js";
import type { ColorsConfig } from "../domain/values/palette.js";
import type { PaperName } from "../domain/values/geometry.js";
import type { FontFamilies } from "../domain/values/fonts.js";

export type { ColorKey, ColorsConfig } from "../domain/values/palette.js";
export type { CommentStyle } from "../domain/values/code-language.js";
export { PAPERS } from "../domain/values/geometry.js";
export type { PaperName } from "../domain/values/geometry.js";

/**
 * The typefaces the book is set in (see `domain/values/fonts.ts`). A book names
 * families, never files: the website loads the families from the webfont
 * stylesheet, and the printed edition asks the system (fontconfig, via LuaLaTeX)
 * for a family by name, so the fonts have to be installed where the build runs.
 * The engine's Docker image carries the defaults.
 */
export type FontsConfig = FontFamilies;

/**
 * The printed edition's page: a paper and its margins, all in millimetres. The
 * text block the PDF builder measures pictures against is derived from these,
 * so a book that changes its margins does not have to say anything else.
 */
export interface GeometryConfig {
  /** Paper name: `a4`, `a5`, `letter` or `legal`. */
  paper: PaperName;
  /** Margins in millimetres. */
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** Text block width: the paper width less the side margins. */
  textWidthMm: number;
  /** Text block height: the paper height less the top and bottom margins. */
  textHeightMm: number;
}

// The printed edition's palette lives in `domain/values/palette.ts` and is
// re-exported above.

/**
 * The printed edition's type scale, in points. Heading leading is 1.2× the
 * size, rounded up to a whole point; `base` is the document class size, one of
 * 10, 11 or 12.
 */
export interface TypeConfig {
  base: number;
  chapter: number;
  section: number;
  subsection: number;
  subsubsection: number;
  paragraph: number;
}

/**
 * What a book may change about the printed edition: its page, its palette and
 * its type scale, plus a file of extra LaTeX for anything else. None of it
 * touches the website, whose look lives in CSS.
 */
export interface TexConfig {
  geometry: GeometryConfig;
  colors: ColorsConfig;
  type: TypeConfig;
  /** Document class (default "book"). */
  class: string;
  /** Page side: "oneside" or "twoside" (default "oneside"). */
  side: "oneside" | "twoside";
  /** `tocdepth` for the table of contents (default 0: chapters only). */
  tocDepth: number;
  /** Print a typographic title page — the title, the tagline and the author —
   *  before the table of contents (default false). */
  titlePage: boolean;
  /** A copyright line for the front matter's imprint page (default: none). */
  copyright: string;
  /** An ISBN for the front matter's imprint page (default: none). */
  isbn: string;
  /** Absolute path of extra LaTeX appended after the built-in preamble, or "". */
  preamble: string;
}

/** A labelled link the site's footer carries. */
export interface WebLinkConfig {
  label: string;
  /** The link target; `{path}` becomes the page's source path from the book
   * root and `{url}` its absolute URL (when `baseUrl` is absolute). */
  href: string;
}

/**
 * What a book may say about its website: where it is published, how it describes
 * itself, and the two escape hatches — a stylesheet appended after the built-in
 * one and extra HTML for every page's `<head>` — the web's counterpart to
 * `tex.preamble`. The two files and the favicon name plain files relative to the
 * book root.
 */
export interface WebConfig {
  /** Absolute path of extra CSS appended after the built-in stylesheet, or "". */
  css: string;
  /** Absolute path of extra `<head>` HTML injected into every page, or "". */
  head: string;
  /** The site's base URL: an absolute URL (`https://example.com/book/`) that
   * also feeds the canonical and social tags, or a root-relative path
   * (`/book/`) that only moves the site's root links. Empty means `/`. */
  baseUrl: string;
  /** The one-line description search engines and social cards show
   * (default: the tagline). */
  description: string;
  /** Absolute path of the site's favicon, copied into the output, or "". */
  favicon: string;
  /** Write a page as `<name>/index.html` instead of `<name>.html` (default
   * false), so its URL carries no extension. The home page is the root's
   * `index.html` either way, and assets — the stylesheet, the favicon, the
   * images — are plain files in both schemes. */
  prettyUrls: boolean;
  /** Labelled links the footer carries, in order. */
  links: WebLinkConfig[];
}

/**
 * The linter's line budgets, in columns. Prose and table rows are counted in
 * characters; a `text` or `ascii` diagram is measured by its own box. The
 * defaults are the widths the printed page and the code panels were sized for.
 */
export interface LintConfig {
  /** Longest prose line the chapter check allows (default 100). */
  proseWidth: number;
  /** Longest Markdown table row (default 240). */
  tableWidth: number;
  /** Widest `text` or `ascii` fence (default 80). */
  diagramWidth: number;
}

/** How the Markdown source is read before either edition renders it. */
export interface MarkdownConfig {
  /** Turn straight quotes into curly ones and `--`/`---` into en and em dashes
   *  in the prose (default false). Code, link targets and raw HTML are left
   *  alone. */
  smartTypography: boolean;
  /** Turn a single newline inside a paragraph into a line break on the website
   *  (default false). GFM hard breaks — two trailing spaces — still break either
   *  way. The printed edition always keeps a single newline soft, so
   *  hard-wrapped prose stays one paragraph on the page. */
  breaks: boolean;
}

/**
 * The themes a diagram may be drawn in. `auto` — the default — builds the
 * palette from `tex.colors`, so a diagram follows the book; every other value
 * is one of Mermaid's own themes, used as it is (see `adapters/diagrams/theme.ts`).
 */
export const DIAGRAM_THEMES = [
  "auto",
  "default",
  "base",
  "dark",
  "forest",
  "neutral",
  "neo",
  "neo-dark",
  "redux",
  "redux-dark",
  "redux-color",
  "redux-dark-color",
  "null",
] as const;

export type DiagramTheme = (typeof DIAGRAM_THEMES)[number];

/** How the `mermaid` diagrams are drawn, in both editions. */
export interface DiagramsConfig {
  /** `auto` derives the palette from `tex.colors`; a Mermaid theme name such as
   *  `dark`, `forest` or `neutral` draws in that theme instead. */
  theme: DiagramTheme;
  /** The diagram type size, in pixels (default 13). */
  fontSize: number;
}

// `CommentStyle` is re-exported above; the language shape lives in
// `domain/values/code-language.ts`.

/** A book's own code-fence language: the chip a block shows and how its
 *  comments are marked, for a language the built-in table does not know. */
export type CodeLangConfig = CodeLanguage;

/** Remote images the build fetches into the output, so neither edition sends
 *  the reader to the origin (see `adapters/http/remote-images.ts`). */
export interface ImagesConfig {
  /** Seconds one fetch may take before it fails (default 30), so a slow host
   *  stalls the build for a bounded time. */
  timeout: number;
  /** Accepted content types, each mapped to the extension the file is saved
   *  as. Empty keeps the engine's built-in map. */
  types: Record<string, string>;
  /** The largest response a fetch accepts, in bytes (default 20 MiB), so a
   *  wrong URL or an endless stream cannot exhaust the build's memory. */
  maxBytes: number;
}

/** The preview server's defaults. */
export interface ServeConfig {
  /** The port `geek-book serve` listens on when its argument names none
   *  (default 4000). */
  port: number;
}

/**
 * A book's resolved settings: the raw config and package metadata after the
 * lenient readers have run, with every path absolute. The engine reads nothing
 * else about *which* book it is building — the title, the sources, the two
 * output paths and every tunable are here.
 */
export interface BookSettings {
  /** The book root: the directory the CLI runs from, or the directory of the
   * config file named by `--config`. */
  root: string;
  /** Absolute path of the config file that named this book. */
  configFile: string;
  title: string;
  tagline: string;
  author: string;
  version: string;
  /** A book's own `{{ … }}` tokens, keyed by token name. The built-in tokens
   * (version, title, author, tagline) are filled regardless and win on a clash. */
  placeholders: Record<string, string>;
  /** The book's language, a BCP 47 tag (default `en`). Sets the web `lang`
   * attribute and, for a language the engine knows, the PDF's babel. */
  language: string;
  /** Overrides for the fixed interface labels (English by default); see
   * `domain/values/ui-strings.ts` for the keys. */
  strings: Record<string, string>;
  /** Absolute path of the Markdown sources (default `<root>/book`). */
  bookDir: string;
  /** Absolute path of the table of contents (default `<bookDir>/SUMMARY.md`). */
  summary: string;
  /** Absolute path of the chapter prose (default `<bookDir>/chapters`). */
  chapters: string;
  /** Absolute path of the website's home page (default `<bookDir>/README.md`;
   * with no file there the home page redirects to the first chapter). */
  readme: string;
  /** Cover image for the PDF (default `<bookDir>/cover.jpg`; may be absent). */
  cover: string;
  /** Absolute output paths. */
  outputWeb: string;
  outputPdf: string;
  /** Whether the website build empties its output directory first (default
   *  true). A book that keeps its own files there sets this false. */
  outputClean: boolean;
  /** Extra Markdown at the root whose links the linter also checks. */
  docs: string[];
  /** Fence languages the linter accepts. */
  languages: Set<string>;
  /** The book's own fence languages, keyed by lower-case tag: a label and a
   * comment style for what the built-in table does not know. Each key is also
   * accepted by the linter. */
  code: Record<string, CodeLangConfig>;
  /** Remote-image fetching. */
  images: ImagesConfig;
  /** Line budgets the chapter check enforces. */
  lint: LintConfig;
  /** How the Markdown source is read before it is rendered. */
  markdown: MarkdownConfig;
  /** How the diagrams are drawn. */
  diagrams: DiagramsConfig;
  /** The typefaces both editions are set in. */
  fonts: FontsConfig;
  /** The website's extra stylesheet and head HTML. */
  web: WebConfig;
  /** The printed edition's page, palette and type scale. */
  tex: TexConfig;
  /** The preview server's defaults. */
  serve: ServeConfig;
}
