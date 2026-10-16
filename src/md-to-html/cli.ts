// Convert a single Markdown file into a standalone HTML page.
//
// The converted body is wrapped in _layouts/default.html, which carries the
// fonts and styles. Heading ids are generated with the same slugifier the
// linter uses, so in-page `#anchor` links land on the ids the site renderers emit.
//
// Usage: geek-book md <input.md> [output.html]
//
// When output is omitted it defaults to <input>.html in the same directory.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { renderStandaloneHtmlFromSource } from "./render.js";
import type { BookConfig } from "../lib/book-config.js";

function usage(): void {
  process.stderr.write("usage: geek-book md <input.md> [output.html]\n");
}

export async function main(cfg: BookConfig, args: string[]): Promise<number> {
  if (args.length < 1 || args.length > 2) {
    usage();
    return 2;
  }
  const [inputArg, outputArg] = args;

  const input = path.resolve(inputArg);
  if (!fs.existsSync(input)) {
    process.stderr.write(`geek-book: ${inputArg}: no such file\n`);
    return 2;
  }
  const output = outputArg ? path.resolve(outputArg) : input.replace(/\.md$/i, ".html");

  const source = fs.readFileSync(input, "utf8");
  const html = await renderStandaloneHtmlFromSource(cfg, source);

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, html);
  console.log(`geek-book: ${path.relative(process.cwd(), input)} -> ${path.relative(process.cwd(), output)}`);
  return 0;
}
