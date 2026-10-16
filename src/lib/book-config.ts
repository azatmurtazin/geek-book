// Where the engine learns *which* book it is building.
//
// A book repo keeps a `book.config.json` at its root and is built by running
// `geek-book` from that root, so the working directory is the book. Everything
// the engine would otherwise have to hard-code about one particular book — the
// title, the tagline, where the sources live, where the editions go — comes
// from there, with defaults that fit the conventional layout. The version is
// read from the book's own package.json unless the config names one, so the
// number still lives in exactly one place.
//
// This module is the public face of that: the pieces live under `book-config/`
// — `types.ts` (the shapes and the paper table), `defaults.ts` (the fallbacks),
// `validators.ts` (the lenient `as*` readers) and `load.ts` (finding the file
// and reading it) — and are re-exported here, so every importer keeps naming
// `book-config.js`.

export type {
  BookConfig,
  CodeLangConfig,
  ColorKey,
  ColorsConfig,
  CommentStyle,
  DiagramTheme,
  DiagramsConfig,
  FontsConfig,
  GeometryConfig,
  ImagesConfig,
  LintConfig,
  MarkdownConfig,
  PaperName,
  ServeConfig,
  TexConfig,
  TypeConfig,
  WebConfig,
  WebLinkConfig,
} from "./book-config/types.js";
export { PAPERS } from "./book-config/types.js";
export type { ConfigOption } from "./book-config/load.js";
export { CONFIG_FILE, load, takeConfigOption } from "./book-config/load.js";
