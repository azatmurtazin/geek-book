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

- **Introduction** — [Installing geek-book](./book/chapters/00_intro/01_installing.md) · [Your first book](./book/chapters/00_intro/02_first_book.md)
- **Writing** — [The book tree](./book/chapters/01_writing/01_tree.md) · [SUMMARY.md](./book/chapters/01_writing/02_summary.md) · [Chapters](./book/chapters/01_writing/03_chapters.md) · [Formatting](./book/chapters/01_writing/04_formatting.md) · [Code](./book/chapters/01_writing/05_code.md)
- **Media** — [Images](./book/chapters/02_media/01_images.md) · [Remote images](./book/chapters/02_media/02_remote.md) · [Diagrams](./book/chapters/02_media/03_diagrams.md)
- **Configuration** — [Fonts](./book/chapters/03_config/01_fonts.md) · [The printed page](./book/chapters/03_config/02_print.md)
- **Publishing** — [Commands](./book/chapters/04_publishing/01_commands.md) · [Linting](./book/chapters/04_publishing/02_lint.md) · [Continuous integration](./book/chapters/04_publishing/03_ci.md)

The rest of this file is a map of the engine repository.

## A book is a directory

The directory `geek-book` runs from is the book; everything else is Markdown:

```
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
| `geek-book serve [dir]`   | Preview the built website.                                 |
| `geek-book lint [family]` | Check the tree, the chapters and the links.                |
| `geek-book md <in> <out>` | Render one Markdown file to a standalone page.             |
| `geek-book config`        | Show the book the engine resolved.                         |

`lint` runs three families — `summary`, `chapters` and `links` — and any of them
can be run alone; see [Commands](./book/chapters/04_publishing/01_commands.md)
and [Linting](./book/chapters/04_publishing/02_lint.md). The same two editions
are built and shipped by the
[CI templates](./book/chapters/04_publishing/03_ci.md).

## This repository

This repository builds its own book — the guide above — which doubles as the
fixture the engine is tested against: `just lint`, `just html` and `just pdf`
exercise the linter and both editions on every change, and CI runs the same
three in the `book` image. There are no unit tests; a book that builds is the
contract.

```sh
just html     # build build/html/
just pdf      # build build/book.pdf
just serve    # preview build/html/ on http://localhost:4000
just lint     # type-check the engine, then lint the guide
```

The same build runs in Docker with no host setup beyond Docker itself:

```sh
just docker-book
```

A book repository depends on the engine by path and copies the book-side
scaffolding under [`templates/`](./templates/) — a `book.config.json`, a
`Justfile`, a compose service, a pre-commit config and three workflows (lint +
build, release, link check). See
[`templates/README.md`](./templates/README.md).

## Layout

| Path              | What lives there                                                                   |
| ----------------- | ---------------------------------------------------------------------------------- |
| `bin/`            | The `geek-book` launcher (registers tsx, imports `src/cli.ts`).                    |
| `src/lib/`        | Shared pieces: config, paths, Markdown, HTML, code tokenizer, images, stylesheets. |
| `src/build-*`     | The two edition builders (website, LaTeX/PDF).                                     |
| `src/lint/`       | Structural checks for the sources.                                                 |
| `src/md-to-html/` | The Markdown→HTML renderer, and a one-file CLI.                                    |
| `_layouts/`       | The standalone HTML shell (previews and `geek-book md`).                           |
| `docker/`         | The build image: Node + LuaLaTeX + the fonts.                                      |
| `templates/`      | Book-side scaffolding (config, Justfile, CI) for a new book repo.                  |
| `book/`           | The user's guide, its `images/` and its cover.                                     |

CSS and the printed preamble are plain files beside the code that reads them
(`src/build-web-book/site.css`, `src/lib/content.css`,
`src/build-tex-book/preamble.tex`) and are pasted in at build time, so neither
has a build step.

## Licence

MIT (see [LICENSE](./LICENSE)).
