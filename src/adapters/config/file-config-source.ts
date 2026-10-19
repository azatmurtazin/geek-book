// The file-backed ConfigSource: find `book.config.json` (or the file named by
// `--config`) and the book's `package.json`, and hand back the parsed JSON.
//
// Reading the files is all this does; turning the JSON into settings is the pure
// `load-settings` use case. It reads through the `FileSystem` port rather than
// `node:fs` so a test can configure a book from memory.

import path from "node:path";
import type { FileSystem } from "../../application/ports/file-system.js";
import type { ConfigSource, RawConfig } from "../../application/ports/config-source.js";
import { CONFIG_FILE } from "../../application/settings/config-option.js";

/** Parse a JSON file, or `null` when it is absent or not valid JSON. */
function readJson(fs: FileSystem, file: string): unknown {
  const text = fs.readText(file);
  if (text === null) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export class FileConfigSource implements ConfigSource {
  /**
   * @param cwd  the directory the CLI ran from — the book, unless `named` says otherwise
   * @param named  the `--config <file>` value, or null for the conventional name
   */
  constructor(
    private readonly fs: FileSystem,
    private readonly cwd: string,
    private readonly named: string | null = null,
  ) {}

  read(): RawConfig {
    // Naming a config builds the book beside that file, so the paths inside the
    // config resolve against its own directory rather than the working one.
    const configFile = this.named ? path.resolve(this.cwd, this.named) : path.join(this.cwd, CONFIG_FILE);
    const root = this.named ? path.dirname(configFile) : this.cwd;
    return {
      root,
      configFile,
      value: readJson(this.fs, configFile),
      packageValue: readJson(this.fs, path.join(root, "package.json")),
    };
  }
}
