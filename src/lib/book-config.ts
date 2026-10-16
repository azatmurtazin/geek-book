// Where the engine learns *which* book it is building.
//
// A book repo keeps a `book.config.json` at its root and is built by running
// `geek-book` from that root, so the working directory is the book. Everything
// the engine would otherwise have to hard-code about one particular book — the
// title, the tagline, where the sources live, where the editions go — comes
// from there, with defaults that fit the conventional layout. The version is
// read from the book's own package.json unless the config names one, so the
// number still lives in exactly one place.

import fs from "node:fs";
import path from "node:path";
import { DEFAULT_LANGS } from "./langs.js";

/** The config file's conventional name, at the root the CLI runs from. */
export const CONFIG_FILE = "book.config.json";

/**
 * The `--config` option pulled out of `argv`, wherever on the line it sits,
 * written `--config <file>` or `--config=<file>`. A book is normally the
 * directory the CLI runs from; naming a config builds the book beside that file
 * instead, so one checkout can build another without changing directory.
 */
export interface ConfigOption {
  /** The named config file, or null when `--config` is absent. */
  file: string | null;
  /** True when `--config` was written with no file after it. */
  missingValue: boolean;
  /** `argv` with the option removed, for the chosen command to parse. */
  argv: string[];
}

/** Read the `--config` option from `argv` and hand back the rest. */
export function takeConfigOption(argv: string[]): ConfigOption {
  const rest: string[] = [];
  let file: string | null = null;
  let missingValue = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--config") {
      const value = argv[i + 1];
      // A following flag is not a filename, so the option has no value.
      if (value === undefined || value.startsWith("-")) {
        missingValue = true;
      } else {
        file = value;
        i += 1;
      }
    } else if (arg.startsWith("--config=")) {
      const value = arg.slice("--config=".length);
      if (value === "") missingValue = true;
      else file = value;
    } else {
      rest.push(arg);
    }
  }
  return { file, missingValue, argv: rest };
}

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

const DEFAULTS = {
  language: "en",
  bookDir: "book",
  webOutput: "build/html",
  pdfOutput: "build/book.pdf",
  docs: ["README.md", "CONTRIBUTING.md"],
  outputClean: true,
  images: { timeout: 30, types: {} },
  serve: { port: 4000 },
  lint: { proseWidth: 100, tableWidth: 240, diagramWidth: 80 },
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

function readJson(file: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
}

/** Like `asString`, but an explicit empty string counts as a value: it turns
 * the setting off (no webfonts, no bold face of its own). */
function asOptionalString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function asStringList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const list = value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
  return list.length ? list : null;
}

/** A `{ token: value }` map of strings, else empty. Values are kept verbatim,
 * so a token may stand for an empty string; non-string values are dropped. */
function asStringMap(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === "string" && key.trim() !== "") out[key.trim()] = item;
  }
  return out;
}

/** A site base URL: an absolute `http(s)` URL or a root-relative path, with a
 * trailing slash, else "". */
function asBaseUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const raw = value.trim();
  if (!raw) return "";
  if (raw.startsWith("/")) return raw.endsWith("/") ? raw : `${raw}/`;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, "")}/`;
  } catch {
    return "";
  }
}

/** The footer links: `{ label, href }` pairs, entries missing either dropped. */
function asWebLinks(value: unknown): WebLinkConfig[] {
  if (!Array.isArray(value)) return [];
  const links: WebLinkConfig[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const { label, href } = item as Record<string, unknown>;
    if (typeof label === "string" && label.trim() && typeof href === "string" && href.trim()) {
      links.push({ label: label.trim(), href: href.trim() });
    }
  }
  return links;
}

/** A length in millimetres: a non-negative finite number, else the default. */
function asMillimetres(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** A point size: a positive finite number, else the default. */
function asPoints(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

/** A line budget in columns: a positive finite number, else the default. */
function asWidth(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

/** The document class size: LaTeX takes 10, 11 or 12. */
function asBaseSize(value: unknown, fallback: number): number {
  return value === 10 || value === 11 || value === 12 ? value : fallback;
}

/** A boolean, else the default. */
function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** A duration in seconds: a positive finite number, else the default. */
function asSeconds(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

/** A TCP port: a whole number in range, else the default. */
function asPort(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 65535
    ? value
    : fallback;
}

/** Accepted remote-image content types, each mapped to a file extension. */
function asContentTypes(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof value !== "object" || value === null) return out;
  for (const [type, ext] of Object.entries(value as Record<string, unknown>)) {
    const key = type.trim().toLowerCase();
    if (key && typeof ext === "string" && ext.trim()) out[key] = ext.trim();
  }
  return out;
}

/** Round to hundredths, so derived lengths read cleanly in the config dump. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** A `#rrggbb` colour, normalized to lower case, else the default. */
function asColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const hex = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : fallback;
}

function asPaper(value: unknown, fallback: PaperName): PaperName {
  return typeof value === "string" && value in PAPERS ? (value as PaperName) : fallback;
}

function readColors(raw: Record<string, unknown>): ColorsConfig {
  return {
    fg: asColor(raw.fg, DEFAULTS.tex.colors.fg),
    muted: asColor(raw.muted, DEFAULTS.tex.colors.muted),
    rule: asColor(raw.rule, DEFAULTS.tex.colors.rule),
    codeBackground: asColor(raw.codeBackground, DEFAULTS.tex.colors.codeBackground),
    codeForeground: asColor(raw.codeForeground, DEFAULTS.tex.colors.codeForeground),
    codeComment: asColor(raw.codeComment, DEFAULTS.tex.colors.codeComment),
    calloutBackground: asColor(raw.calloutBackground, DEFAULTS.tex.colors.calloutBackground),
    calloutBorder: asColor(raw.calloutBorder, DEFAULTS.tex.colors.calloutBorder),
    calloutForeground: asColor(raw.calloutForeground, DEFAULTS.tex.colors.calloutForeground),
  };
}

function readType(raw: Record<string, unknown>): TypeConfig {
  return {
    base: asBaseSize(raw.base, DEFAULTS.tex.type.base),
    chapter: asPoints(raw.chapter, DEFAULTS.tex.type.chapter),
    section: asPoints(raw.section, DEFAULTS.tex.type.section),
    subsection: asPoints(raw.subsection, DEFAULTS.tex.type.subsection),
    subsubsection: asPoints(raw.subsubsection, DEFAULTS.tex.type.subsubsection),
    paragraph: asPoints(raw.paragraph, DEFAULTS.tex.type.paragraph),
  };
}

function readLint(raw: Record<string, unknown>): LintConfig {
  return {
    proseWidth: asWidth(raw.proseWidth, DEFAULTS.lint.proseWidth),
    tableWidth: asWidth(raw.tableWidth, DEFAULTS.lint.tableWidth),
    diagramWidth: asWidth(raw.diagramWidth, DEFAULTS.lint.diagramWidth),
  };
}

/** The book's `code` map: lower-case tags, each with a label and comment style. */
function readCode(raw: Record<string, unknown>): Record<string, CodeLangConfig> {
  const out: Record<string, CodeLangConfig> = {};
  for (const [tag, value] of Object.entries(raw)) {
    const lang = tag.trim().toLowerCase();
    if (!lang || typeof value !== "object" || value === null) continue;
    const entry = value as Record<string, unknown>;
    out[lang] = { label: asString(entry.label, ""), comment: asCommentStyle(entry.comment) };
  }
  return out;
}

/** `slash` or `hash`, else "" (keep the built-in choice). */
function asCommentStyle(value: unknown): CommentStyle | "" {
  return value === "slash" || value === "hash" ? value : "";
}

export function load(): BookConfig {
  const cwd = process.cwd();
  // `--config <file>` names the book: its directory is the root, so the paths
  // inside the config resolve beside it. Without one the book is the directory
  // the CLI runs from. The choice is made here, at import, because `CONFIG` is
  // read at module scope by the builders and the linter.
  const named = takeConfigOption(process.argv.slice(2)).file;
  const configFile = named ? path.resolve(cwd, named) : path.join(cwd, CONFIG_FILE);
  const root = named ? path.dirname(configFile) : cwd;
  const raw = readJson(configFile) ?? {};
  const fonts = (raw.fonts ?? {}) as Record<string, unknown>;
  const output = (raw.output ?? {}) as Record<string, unknown>;
  const web = (raw.web ?? {}) as Record<string, unknown>;
  const images = (raw.images ?? {}) as Record<string, unknown>;
  const serve = (raw.serve ?? {}) as Record<string, unknown>;
  const lint = (raw.lint ?? {}) as Record<string, unknown>;
  const codeLangs = readCode((raw.code ?? {}) as Record<string, unknown>);
  const tex = (raw.tex ?? {}) as Record<string, unknown>;
  const geometryRaw = (tex.geometry ?? {}) as Record<string, unknown>;
  const packageJson = readJson(path.join(root, "package.json")) ?? {};

  const bookDir = path.resolve(root, asString(raw.bookDir, DEFAULTS.bookDir));
  const cover = asString(raw.cover, "");
  // The table of contents, the front page and the prose directory may sit
  // anywhere; SUMMARY's chapter paths still resolve against `bookDir`, as the
  // builders and the linter expect.
  const summary = asString(raw.summary, "");
  const chapters = asString(raw.chapters, "");
  const readme = asString(raw.readme, "");
  const text = asString(fonts.text, DEFAULTS.fonts.text);
  const code = asString(fonts.code, DEFAULTS.fonts.code);
  const builtIn = text === DEFAULTS.fonts.text && code === DEFAULTS.fonts.code;
  const webCss = asString(web.css, DEFAULTS.web.css);
  const webHead = asString(web.head, DEFAULTS.web.head);
  const webBaseUrl = asBaseUrl(web.baseUrl);
  const webFavicon = asString(web.favicon, "");

  const paper = asPaper(geometryRaw.paper, DEFAULTS.tex.geometry.paper);
  const top = asMillimetres(geometryRaw.top, DEFAULTS.tex.geometry.top);
  const bottom = asMillimetres(geometryRaw.bottom, DEFAULTS.tex.geometry.bottom);
  const left = asMillimetres(geometryRaw.left, DEFAULTS.tex.geometry.left);
  const right = asMillimetres(geometryRaw.right, DEFAULTS.tex.geometry.right);
  const paperSize = PAPERS[paper];
  const extraPreamble = asString(tex.preamble, "");

  // A language the book describes under `code` is one it teaches the renderers,
  // so the linter accepts its fence tag too.
  const languages = new Set(asStringList(raw.languages) ?? DEFAULT_LANGS);
  for (const lang of Object.keys(codeLangs)) {
    languages.add(lang);
  }

  return {
    root,
    configFile,
    title: asString(raw.title, asString(packageJson.name, "Untitled book")),
    tagline: asString(raw.tagline, ""),
    author: asString(raw.author, ""),
    version: asString(raw.version, asString(packageJson.version, "0.0.0")),
    placeholders: asStringMap(raw.placeholders),
    language: asString(raw.language, DEFAULTS.language),
    strings: asStringMap(raw.strings),
    bookDir,
    summary: summary ? path.resolve(root, summary) : path.join(bookDir, "SUMMARY.md"),
    chapters: chapters ? path.resolve(root, chapters) : path.join(bookDir, "chapters"),
    readme: readme ? path.resolve(root, readme) : path.join(bookDir, "README.md"),
    cover: cover ? path.resolve(root, cover) : path.join(bookDir, "cover.jpg"),
    outputWeb: path.resolve(root, asString(output.web, DEFAULTS.webOutput)),
    outputPdf: path.resolve(root, asString(output.pdf, DEFAULTS.pdfOutput)),
    outputClean: asBool(output.clean, DEFAULTS.outputClean),
    docs: (asStringList(raw.docs) ?? [...DEFAULTS.docs]).map((doc) => path.resolve(root, doc)),
    languages,
    code: codeLangs,
    images: {
      timeout: asSeconds(images.timeout, DEFAULTS.images.timeout),
      types: asContentTypes(images.types),
    },
    lint: readLint(lint),
    fonts: {
      text,
      // The default bold face belongs to the default family: a book that names
      // another family gets that family's own bold, not Literata's instance of
      // it, unless it spells the bold face out.
      bold: asOptionalString(fonts.bold, text === DEFAULTS.fonts.text ? DEFAULTS.fonts.bold : ""),
      code,
      // The built-in stylesheet asks for the built-in families, so it stays with
      // them: a book that names its own families starts with no webfont and can
      // name one (or say "" for none) under `web`.
      web: asOptionalString(fonts.web, builtIn ? DEFAULTS.fonts.web : ""),
    },
    tex: {
      geometry: {
        paper,
        top,
        bottom,
        left,
        right,
        // A margin wider than the paper clamps to a hairline rather than a
        // non-positive block, which would break the picture scaling.
        textWidthMm: round2(Math.max(1, paperSize.widthMm - left - right)),
        textHeightMm: round2(Math.max(1, paperSize.heightMm - top - bottom)),
      },
      colors: readColors((tex.colors ?? {}) as Record<string, unknown>),
      type: readType((tex.type ?? {}) as Record<string, unknown>),
      class: asString(tex.class, DEFAULTS.tex.class),
      side: tex.side === "twoside" ? "twoside" : DEFAULTS.tex.side,
      tocDepth: asWidth(tex.tocDepth, DEFAULTS.tex.tocDepth),
      preamble: extraPreamble ? path.resolve(root, extraPreamble) : "",
    },
    web: {
      css: webCss ? path.resolve(root, webCss) : "",
      head: webHead ? path.resolve(root, webHead) : "",
      baseUrl: webBaseUrl,
      description: asString(web.description, asString(raw.tagline, "")),
      favicon: webFavicon ? path.resolve(root, webFavicon) : "",
      links: asWebLinks(web.links),
    },
    serve: {
      port: asPort(serve.port, DEFAULTS.serve.port),
    },
  };
}
