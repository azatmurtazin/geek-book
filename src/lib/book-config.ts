// Where the engine learns *which* book it is building — a shim over the
// application's settings, kept until Phase 8 so every importer keeps naming
// `book-config.js`.
//
// A book repo keeps a `book.config.json` at its root and is built by running
// `geek-book` from that root, so the working directory is the book. The shapes
// and the readers now live under `application/settings*`; this module re-exports
// them under the names the engine has always used and adds the one file-based
// convenience, `load`.

import process from "node:process";
import { FileConfigSource } from "../adapters/config/file-config-source.js";
import { NodeFileSystem } from "../adapters/fs/node-file-system.js";
import { loadSettings } from "../application/usecases/load-settings.js";
import type { BookSettings } from "../application/settings.js";

export type {
  BookSettings as BookConfig,
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
} from "../application/settings.js";
export { PAPERS } from "../application/settings.js";
export type { ConfigOption } from "../application/settings/config-option.js";
export { CONFIG_FILE, takeConfigOption } from "../application/settings/config-option.js";

/**
 * The book for `cwd`, or for the config file `named` (`--config <file>`), whose
 * directory is then the root, so the paths inside the config resolve beside it.
 * Both default to the process; tests pass them explicitly, so a fixture book
 * loads without changing directory or reading the command line.
 */
export function load(cwd: string = process.cwd(), named: string | null = null): BookSettings {
  return loadSettings(new FileConfigSource(new NodeFileSystem(), cwd, named).read()).settings;
}
