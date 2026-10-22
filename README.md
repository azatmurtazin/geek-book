# geek-book

A small build engine for books. You write Markdown; it produces a **static
website** and a **print-ready PDF** from the same sources.

```sh
npm install
npx geek-book web      # → build/html/
npx geek-book pdf      # → build/book.pdf
```

## The guide

The engine documents itself: [`book/`](./book/) is the user's guide, built by the
same engine it describes. Its table of contents is
[`book/SUMMARY.md`](./book/SUMMARY.md); the chapters are:

- [Introduction](./book/chapters/00_intro/00_index.md)
  - [Installing geek-book](./book/chapters/00_intro/01_installing.md)
  - [Your first book](./book/chapters/00_intro/02_first_book.md)
- [Writing](./book/chapters/01_writing/00_index.md)
  - [The book tree](./book/chapters/01_writing/01_tree.md)
  - [SUMMARY.md](./book/chapters/01_writing/02_summary.md)
  - [Chapters](./book/chapters/01_writing/03_chapters.md)
  - [Formatting](./book/chapters/01_writing/04_formatting.md)
  - [Code](./book/chapters/01_writing/05_code.md)
- [Media](./book/chapters/02_media/00_index.md)
  - [Images](./book/chapters/02_media/01_images.md)
  - [Remote images](./book/chapters/02_media/02_remote.md)
  - [Diagrams](./book/chapters/02_media/03_diagrams.md)
- [Configuration](./book/chapters/03_config/00_index.md)
  - [Fonts](./book/chapters/03_config/01_fonts.md)
  - [The printed page](./book/chapters/03_config/02_print.md)
- [Publishing](./book/chapters/04_publishing/00_index.md)
  - [Commands](./book/chapters/04_publishing/01_commands.md)
  - [Linting](./book/chapters/04_publishing/02_lint.md)
  - [Continuous integration](./book/chapters/04_publishing/03_ci.md)

The rest of this file is a map of the engine repository.

## A book is a directory

The directory `geek-book` runs from is the book; everything else is Markdown:

```text
book.config.json     # title, tagline, sources, outputs (all optional but title)
book/SUMMARY.md      # the table of contents, and the chapter order
book/README.md       # becomes the website's front page
book/chapters/       # the prose, one directory per chapter group
book/images/         # pictures the prose uses, and the cover
```

Those paths are `book.config.json`'s defaults, so it is the only file specific
to your book, and `npx geek-book config` prints what the engine resolved. See
[The book tree](./book/chapters/01_writing/01_tree.md) for the layout, and
[Fonts](./book/chapters/03_config/01_fonts.md) and
[The printed page](./book/chapters/03_config/02_print.md) for what it configures.

## Commands

| Command                   | What it does                                               |
| ------------------------- | ---------------------------------------------------------- |
| `geek-book web [dir]`     | Build the website.                                         |
| `geek-book pdf [file]`    | Build the PDF (needs LuaLaTeX, `rsvg-convert`, `pdfinfo`). |
| `geek-book serve [dir] [--watch]` | Preview the built website (`--watch` rebuilds on saves). |
| `geek-book lint [family]` | Check the tree, the chapters and the links.                |
| `geek-book md <in> <out>` | Render one Markdown file to a standalone page.             |
| `geek-book config`        | Show the book the engine resolved.                         |

`lint` runs four families — `summary`, `chapters`, `links` and `config` — and any
of them can be run alone; see
[Commands](./book/chapters/04_publishing/01_commands.md) and
[Linting](./book/chapters/04_publishing/02_lint.md). The same two editions are
built and shipped by the
[CI templates](./book/chapters/04_publishing/03_ci.md). A command builds the book
in the working directory; `--config <file>` points it at another config instead.

## This repository

This repository builds its own book — the guide above — and that book is also
the end-to-end fixture. `just lint`, `just html` and `just pdf` exercise the
linter and both editions on every change, and `just test` covers the domain,
the use cases and the adapters. `just verify` rebuilds both editions from a
clean output directory and diffs them against `test/baseline/`, so a change
that moves the website's bytes, the PDF's text and page count, the lint messages
or the resolved config fails even when the build itself is green. CI runs the
tests on Node 20, 22 and 26 and the same build and verify steps in the `book`
image.

```sh
just html      # build build/html/
just pdf       # build build/book.pdf
just serve     # preview build/html/ on http://localhost:4000
just serve --watch  # the same, rebuilding when a book file is saved
just lint      # type-check, lint the guide, check the architectural boundaries
just test      # run the unit suite
just coverage  # the unit suite with a coverage report
just verify    # clean rebuild and diff both editions against test/baseline/
```

The same build runs in Docker with no host setup beyond Docker itself:

```sh
just docker-book
```

A release is cut from a clean `main` whose changelog already carries the new
version's section and table row:

```sh
just release 0.1.6
```

The recipe bumps `package.json` and the lock, refreshes the baseline in the
`book` image, verifies it there, commits, tags `v0.1.6` and pushes both. The
tag's workflow then builds and publishes the three assets.

A book repository depends on the engine by path and copies the book-side
scaffolding under [`templates/`](./templates/) — a `book.config.json`, a
`Justfile`, a compose service, a pre-commit config and three workflows (lint +
build, release, link check). See
[`templates/README.md`](./templates/README.md).

## Layout

The engine is one dependency rule deep: `domain` knows nothing outside itself,
`application` knows `domain`, adapters implement the application's ports, and
`cli` assembles the adapters. `.dependency-cruiser.cjs` enforces it.

| Path               | What lives there                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| `bin/`             | The `geek-book` launcher (registers tsx, imports `src/cli/main.ts`).                              |
| `src/domain/`      | The pure core: the document model, values (slugs, fonts, palettes, geometry) and services (assemble, links, images, summary, anchors). No `node:` and no third-party imports. |
| `src/application/` | Ports, use cases, pipelines and settings. `BookSettings` and the lenient readers; one use case per command. |
| `src/adapters/`    | The outside world behind the ports: `markdown/` (marked), `diagrams/` (mermaid + jsdom), `render-html/`, `render-tex/`, `web/`, `http/`, `fs/`, `process/`, `config/`, `lint/`, `templates/`, `images/`, `reporting/`. |
| `src/cli/`         | The composition root (`main.ts`, `context.ts`) and one thin command per subcommand.               |
| `docker/`          | The build image: Node + LuaLaTeX + the fonts.                                                     |
| `templates/`       | Book-side scaffolding (config, Justfile, CI) for a new book repo.                                 |
| `book/`            | The user's guide, its `images/` and its cover.                                                    |

Plain assets sit beside the reader that opens them: the standalone layout and
the LaTeX preamble (`src/adapters/templates/default-layout.html`,
`src/adapters/render-tex/preamble.tex`) and the two stylesheets
(`src/adapters/render-html/content.css`, `src/adapters/web/site.css`). They are
pasted in at build time, so neither has a build step.

## License

MIT (see [LICENSE](./LICENSE)).
