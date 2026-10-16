// The shapes a book's config takes, and the paper table they name.
//
// `BookConfig` is the one the rest of the engine sees; the others describe the
// sections it is assembled from. Nothing here reads or defaults anything — that
// is `validators.ts` and `defaults.ts`.

/**
 * The typefaces the book is set in. A book names families, never files: the
 * website loads the families from the webfont stylesheet, and the printed
 * edition asks the system (fontconfig, via LuaLaTeX) for a family by name, so
 * the fonts have to be installed where the build runs. The engine's Docker
 * image carries the defaults.
 */
export interface FontsConfig {
  /** Family the body text, the headings and the diagrams are set in. */
  text: string;
  /**
   * The text font's bold face, as a fontspec declaration (`Family:options`).
   * Only needed when bold is a weight instance of a variable font rather than a
   * face of its own, since fontconfig then reports no bold for the family —
   * which is the case for the default, Literata. Empty leaves the family's own
   * bold, which is what a book that names its own family starts out with.
   */
  bold: string;
  /** Family code blocks are set in. */
  code: string;
  /**
   * Webfont stylesheet the website and previews load. Empty loads none. The
   * default is the engine's own stylesheet while the families are the engine's;
   * a book with families of its own starts with no webfont.
   */
  web: string;
}

/** The papers a book may set, with their dimensions in millimetres. */
export const PAPERS = {
  a4: { option: "a4paper", widthMm: 210, heightMm: 297 },
  a5: { option: "a5paper", widthMm: 148, heightMm: 210 },
  letter: { option: "letterpaper", widthMm: 215.9, heightMm: 279.4 },
  legal: { option: "legalpaper", widthMm: 215.9, heightMm: 355.6 },
} as const;

export type PaperName = keyof typeof PAPERS;

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

/** How comments are introduced in a code fence. */
export type CommentStyle = "slash" | "hash";

/** A book's own code-fence language: the chip a block shows and how its
 *  comments are marked, for a language the built-in table does not know. */
export interface CodeLangConfig {
  /** The label the block shows; a language with none shows no chip. */
  label: string;
  /** Its comment syntax, or "" to keep the built-in choice (usually none). */
  comment: CommentStyle | "";
}

/** Remote images the build fetches into the output, so neither edition sends
 *  the reader to the origin (see `lib/remote-images.ts`). */
export interface ImagesConfig {
  /** Seconds one fetch may take before it fails (default 30), so a slow host
   *  stalls the build for a bounded time. */
  timeout: number;
  /** Accepted content types, each mapped to the extension the file is saved
   *  as. Empty keeps the engine's built-in map. */
  types: Record<string, string>;
}

/** The preview server's defaults. */
export interface ServeConfig {
  /** The port `geek-book serve` listens on when its argument names none
   *  (default 4000). */
  port: number;
}

export interface BookConfig {
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
   * `lib/ui-strings.ts` for the keys. */
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
  /** The typefaces both editions are set in. */
  fonts: FontsConfig;
  /** The website's extra stylesheet and head HTML. */
  web: WebConfig;
  /** The printed edition's page, palette and type scale. */
  tex: TexConfig;
  /** The preview server's defaults. */
  serve: ServeConfig;
}
