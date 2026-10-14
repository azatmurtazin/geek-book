#!/usr/bin/env node
// The geek-book launcher.
//
// The engine ships as TypeScript source, so the launcher registers tsx and then
// imports the CLI. Everything after the binary name is a geek-book command; the
// CLI parses process.argv itself, exactly as if node had run src/cli.ts.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { tsImport } from "tsx/esm/api";

const here = path.dirname(fileURLToPath(import.meta.url));

await tsImport(path.join(here, "..", "src", "cli.ts"), import.meta.url);
