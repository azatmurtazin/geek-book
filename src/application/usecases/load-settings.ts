// Turning a book's raw JSON into settings.
//
// The `ConfigSource` port hands over the parsed `book.config.json` and the
// book's `package.json` exactly as they were on disk; this use case walks them
// through the lenient readers, resolves every path against the book root, and
// answers the `BookSettings` the rest of the engine sees. It never throws and
// never reads a file — a malformed value degrades to the default — so a book
// with a broken `book.config.json` still builds the conventional book.

import type { Diagnostic } from "../../domain/diagnostics.js";
import { DEFAULT_LANGS } from "../../domain/values/code-language.js";
import { textBlock } from "../../domain/values/geometry.js";
import { join, resolve } from "../../domain/values/posix-path.js";
import type { BookSettings } from "../settings.js";
import { DEFAULTS } from "../settings/defaults.js";
import type { RawConfig } from "../ports/config-source.js";
import {
  asBaseUrl,
  asBool,
  asBytes,
  asContentTypes,
  asMillimetres,
  asOptionalString,
  asPaper,
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
} from "../settings/readers.js";

/** What `loadSettings` answers: the settings, and anything worth reporting. */
export interface LoadedSettings {
  settings: BookSettings;
  /**
   * What the readers noticed. The readers are lenient — a bad value falls back
   * to the default rather than failing — so a malformed config reports here and
   * still builds; today the readers report nothing, and the channel is here for
   * the ones that will.
   */
  diagnostics: Diagnostic[];
}

/** A JSON object, or `{}` for anything else (a missing file, an array, a scalar). */
function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Assemble the book's settings from its raw config and package metadata. */
export function loadSettings(rawConfig: RawConfig): LoadedSettings {
  const root = rawConfig.root;
  const raw = asObject(rawConfig.value);
  const packageJson = asObject(rawConfig.packageValue);
  const fonts = asObject(raw.fonts);
  const output = asObject(raw.output);
  const web = asObject(raw.web);
  const images = asObject(raw.images);
  const serve = asObject(raw.serve);
  const lint = asObject(raw.lint);
  const markdown = asObject(raw.markdown);
  const diagrams = asObject(raw.diagrams);
  const codeLangs = readCode(asObject(raw.code));
  const tex = asObject(raw.tex);
  const geometryRaw = asObject(tex.geometry);

  const bookDir = resolve(root, asString(raw.bookDir, DEFAULTS.bookDir));
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
  const extraPreamble = asString(tex.preamble, "");

  // A language the book describes under `code` is one it teaches the renderers,
  // so the linter accepts its fence tag too.
  const languages = new Set(asStringList(raw.languages) ?? DEFAULT_LANGS);
  for (const lang of Object.keys(codeLangs)) {
    languages.add(lang);
  }

  const settings: BookSettings = {
    root,
    configFile: rawConfig.configFile,
    title: asString(raw.title, asString(packageJson.name, "Untitled book")),
    tagline: asString(raw.tagline, ""),
    author: asString(raw.author, ""),
    version: asString(raw.version, asString(packageJson.version, "0.0.0")),
    placeholders: asStringMap(raw.placeholders),
    language: asString(raw.language, DEFAULTS.language),
    strings: asStringMap(raw.strings),
    bookDir,
    summary: summary ? resolve(root, summary) : join(bookDir, "SUMMARY.md"),
    chapters: chapters ? resolve(root, chapters) : join(bookDir, "chapters"),
    readme: readme ? resolve(root, readme) : join(bookDir, "README.md"),
    cover: cover ? resolve(root, cover) : join(bookDir, "cover.jpg"),
    outputWeb: resolve(root, asString(output.web, DEFAULTS.webOutput)),
    outputPdf: resolve(root, asString(output.pdf, DEFAULTS.pdfOutput)),
    outputClean: asBool(output.clean, DEFAULTS.outputClean),
    docs: (asStringList(raw.docs) ?? [...DEFAULTS.docs]).map((doc) => resolve(root, doc)),
    languages,
    code: codeLangs,
    images: {
      timeout: asSeconds(images.timeout, DEFAULTS.images.timeout),
      types: asContentTypes(images.types),
      maxBytes: asBytes(images.maxBytes, DEFAULTS.images.maxBytes),
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
        ...textBlock(paper, { top, bottom, left, right }),
      },
      colors: readColors(asObject(tex.colors)),
      type: readType(asObject(tex.type)),
      class: asString(tex.class, DEFAULTS.tex.class),
      side: tex.side === "twoside" ? "twoside" : DEFAULTS.tex.side,
      tocDepth: asWidth(tex.tocDepth, DEFAULTS.tex.tocDepth),
      titlePage: asBool(tex.titlePage, DEFAULTS.tex.titlePage),
      copyright: asString(tex.copyright, DEFAULTS.tex.copyright),
      isbn: asString(tex.isbn, DEFAULTS.tex.isbn),
      preamble: extraPreamble ? resolve(root, extraPreamble) : "",
    },
    web: {
      css: webCss ? resolve(root, webCss) : "",
      head: webHead ? resolve(root, webHead) : "",
      baseUrl: webBaseUrl,
      description: asString(web.description, asString(raw.tagline, "")),
      favicon: webFavicon ? resolve(root, webFavicon) : "",
      prettyUrls: asBool(web.prettyUrls, DEFAULTS.web.prettyUrls),
      links: asWebLinks(web.links),
    },
    serve: {
      port: asPort(serve.port, DEFAULTS.serve.port),
    },
  };

  return { settings, diagnostics: [] };
}
