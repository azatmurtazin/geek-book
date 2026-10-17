// Finding the book's config file and reading it into a `BookConfig`.
//
// The `--config` option (`takeConfigOption`), the conventional file name
// (`CONFIG_FILE`), and `load`, which walks the raw JSON through the readers in
// `validators.ts`. A book is normally the directory the CLI runs from; naming a
// config builds the book beside that file instead.

import fs from "node:fs";
import path from "node:path";
import { DEFAULT_LANGS } from "../langs.js";
import type { BookConfig } from "./types.js";
import { PAPERS } from "./types.js";
import { DEFAULTS } from "./defaults.js";
import {
  asBaseUrl,
  asBool,
  asContentTypes,
  asMillimetres,
  asOptionalString,
  asPaper,
  asPoints,
  asPort,
  asSeconds,
  asString,
  asStringList,
  asStringMap,
  asWebLinks,
  asWidth,
  readCode,
  readColors,
  readDiagrams,
  readLint,
  readMarkdown,
  readType,
  round2,
} from "./validators.js";

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

function readJson(file: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * The book for `cwd`, or for the config file `named` (`--config <file>`), whose
 * directory is then the root, so the paths inside the config resolve beside it.
 * Both default to the process; tests pass them explicitly, so a fixture book
 * loads without changing directory or reading the command line.
 */
export function load(cwd: string = process.cwd(), named: string | null = null): BookConfig {
  const configFile = named ? path.resolve(cwd, named) : path.join(cwd, CONFIG_FILE);
  const root = named ? path.dirname(configFile) : cwd;
  const raw = readJson(configFile) ?? {};
  const fonts = (raw.fonts ?? {}) as Record<string, unknown>;
  const output = (raw.output ?? {}) as Record<string, unknown>;
  const web = (raw.web ?? {}) as Record<string, unknown>;
  const images = (raw.images ?? {}) as Record<string, unknown>;
  const serve = (raw.serve ?? {}) as Record<string, unknown>;
  const lint = (raw.lint ?? {}) as Record<string, unknown>;
  const markdown = (raw.markdown ?? {}) as Record<string, unknown>;
  const diagrams = (raw.diagrams ?? {}) as Record<string, unknown>;
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
    markdown: readMarkdown(markdown),
    diagrams: readDiagrams(diagrams),
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
      titlePage: asBool(tex.titlePage, DEFAULTS.tex.titlePage),
      copyright: asString(tex.copyright, DEFAULTS.tex.copyright),
      isbn: asString(tex.isbn, DEFAULTS.tex.isbn),
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
