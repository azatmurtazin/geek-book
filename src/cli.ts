// The geek-book command line.
//
// A book is whatever directory this runs from: the working directory and its
// book.config.json decide which book is built, and the book's own package.json
// supplies the version. Every command below is a thin wrapper over a module in
// this package, so a book repo needs nothing but this binary and its Markdown.
//
//   geek-book web [dir]        build the website (default: build/html)
//   geek-book pdf [file]       build the PDF     (default: build/book.pdf)
//   geek-book serve [dir] [p]  preview the built website
//   geek-book lint [family…]   check the sources (summary, chapters, links, config)
//   geek-book md <in> [out]    render one Markdown file on its own
//   geek-book pdf-info <pdf>   page count, page size and friends
//   geek-book config           print the resolved book configuration
//
// `--config <file>` may sit anywhere on the line. The book is then the one
// beside that config file rather than the directory the CLI runs from, so a
// checkout can build another book without changing directory.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { load as loadConfig, takeConfigOption, type BookConfig } from "./lib/book-config.js";

interface Command {
  /** One-liner for the help text. */
  summary: string;
  run: (args: string[]) => Promise<number> | number;
}

const cfg: BookConfig = loadConfig();

const COMMANDS: Record<string, Command> = {
  web: {
    summary: "build the website (default: build/html)",
    run: async (args) => (await import("./build-web-book/cli.js")).main(cfg, args),
  },
  pdf: {
    summary: "build the PDF (default: build/book.pdf)",
    run: async (args) => (await import("./build-tex-book/cli.js")).main(cfg, args),
  },
  serve: {
    summary: "preview the built website",
    run: async (args) => (await import("./serve/cli.js")).main(cfg, args),
  },
  lint: {
    summary: "check the sources (summary, chapters, links, config)",
    run: async (args) => (await import("./lint/cli.js")).main(cfg, args),
  },
  md: {
    summary: "render one Markdown file to a standalone HTML page",
    run: async (args) => (await import("./md-to-html/cli.js")).main(cfg, args),
  },
  "pdf-info": {
    summary: "print info about a PDF",
    run: async (args) => (await import("./pdf-info/cli.js")).main(args),
  },
  config: {
    summary: "print the resolved book configuration",
    run: () => {
      printConfig(cfg);
      return 0;
    },
  },
};

/** Paths relative to the book root, so the output reads the same everywhere. */
function rel(root: string, target: string): string {
  return path.relative(root, target) || ".";
}

function printConfig(cfg: BookConfig): void {
  console.log(JSON.stringify(
    {
      root: ".",
      configFile: rel(cfg.root, cfg.configFile),
      title: cfg.title,
      tagline: cfg.tagline,
      author: cfg.author,
      version: cfg.version,
      placeholders: cfg.placeholders,
      language: cfg.language,
      strings: cfg.strings,
      bookDir: rel(cfg.root, cfg.bookDir),
      summary: rel(cfg.root, cfg.summary),
      chapters: rel(cfg.root, cfg.chapters),
      readme: rel(cfg.root, cfg.readme),
      cover: rel(cfg.root, cfg.cover),
      outputWeb: rel(cfg.root, cfg.outputWeb),
      outputPdf: rel(cfg.root, cfg.outputPdf),
      outputClean: cfg.outputClean,
      docs: cfg.docs.map((path) => rel(cfg.root, path)),
      fonts: cfg.fonts,
      web: {
        css: cfg.web.css ? rel(cfg.root, cfg.web.css) : "",
        head: cfg.web.head ? rel(cfg.root, cfg.web.head) : "",
        baseUrl: cfg.web.baseUrl,
        description: cfg.web.description,
        favicon: cfg.web.favicon ? rel(cfg.root, cfg.web.favicon) : "",
        links: cfg.web.links,
      },
      tex: {
        geometry: cfg.tex.geometry,
        colors: cfg.tex.colors,
        type: cfg.tex.type,
        class: cfg.tex.class,
        side: cfg.tex.side,
        tocDepth: cfg.tex.tocDepth,
        preamble: cfg.tex.preamble ? rel(cfg.root, cfg.tex.preamble) : "",
      },
      languages: [...cfg.languages],
      code: cfg.code,
      images: cfg.images,
      lint: cfg.lint,
      serve: cfg.serve,
    },
    null,
    2,
  ));
}

function usage(cfg: BookConfig): void {
  const width = Math.max(...Object.keys(COMMANDS).map((name) => name.length));
  const lines = [
    `geek-book — build "${cfg.title}" (${cfg.root})`,
    "",
    "usage: geek-book <command> [args]",
    "",
    ...Object.entries(COMMANDS).map(([name, cmd]) => `  ${name.padEnd(width)}  ${cmd.summary}`),
    "",
    "The book is the directory geek-book runs from: it reads book.config.json and",
    "the sources under book/, then writes the website and the print PDF.",
    "",
    "`--config <file>` builds the book beside another config file instead.",
  ];
  process.stderr.write(`${lines.join("\n")}\n`);
}

async function main(cfg: BookConfig, argv: string[]): Promise<number> {
  const option = takeConfigOption(argv);
  if (option.missingValue) {
    process.stderr.write("geek-book: --config needs a file\n\n");
    usage(cfg);
    return 2;
  }
  if (option.file) {
    const file = path.resolve(process.cwd(), option.file);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      process.stderr.write(`geek-book: no such config file: ${option.file}\n`);
      return 2;
    }
  }
  const [command, ...args] = option.argv;
  if (!command || command === "help" || command === "--help" || command === "-h") {
    usage(cfg);
    return command ? 0 : 2;
  }
  const chosen = COMMANDS[command];
  if (!chosen) {
    process.stderr.write(`geek-book: unknown command '${command}'\n\n`);
    usage(cfg);
    return 2;
  }
  return chosen.run(args);
}

process.exitCode = await main(cfg, process.argv.slice(2));
