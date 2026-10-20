// The config of a fixture book under `test/fixtures/`, loaded the way the CLI
// loads a real one: the file adapter reads `book.config.json` and the pure
// loader turns it into settings. Tests hand the loader a directory instead of
// changing the working directory, so the engine's own `book.config.json` is
// never read and every test starts from a known book.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileConfigSource } from "../../src/adapters/config/file-config-source.js";
import { NodeFileSystem } from "../../src/adapters/fs/node-file-system.js";
import type { BookSettings } from "../../src/application/settings.js";
import { loadSettings } from "../../src/application/usecases/load-settings.js";

const here = path.dirname(fileURLToPath(import.meta.url));

/** The settings of the book rooted at `root`, or of the config file `named`. */
export function loadFrom(root: string, named: string | null = null): BookSettings {
  return loadSettings(new FileConfigSource(new NodeFileSystem(), root, named).read()).settings;
}

/** The configuration of the fixture book `name` under `test/fixtures/`. */
export function fixtureConfig(name = "minimal"): BookSettings {
  return loadFrom(path.resolve(here, "..", "fixtures", name));
}
