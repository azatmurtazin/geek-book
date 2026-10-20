// The config of a fixture book under `test/fixtures/`, loaded the way the CLI
// loads a real one (see `load` in `src/lib/book-config.ts`). Tests hand the
// loader a directory instead of changing the working directory, so the engine's
// own `book.config.json` is never read and every test starts from a known book.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "../../src/lib/book-config.js";
import type { BookSettings } from "../../src/application/settings.js";

const here = path.dirname(fileURLToPath(import.meta.url));

/** The configuration of the fixture book `name` under `test/fixtures/`. */
export function fixtureConfig(name = "minimal"): BookSettings {
  return load(path.resolve(here, "..", "fixtures", name));
}
