# geek-book

A small build engine for books. You write Markdown; it produces a **static
website** and a **print-ready PDF** from the same sources.

```sh
npm install
npx geek-book web      # → build/html/
npx geek-book pdf      # → build/book.pdf
```

## What a book is

The directory `geek-book` runs from is the book. Everything else is Markdown:

```
book.config.json     # title, tagline, sources, outputs (all optional but title)
book/SUMMARY.md      # the table of contents, and the chapter order
book/README.md       # becomes the website's front page
book/chapters/       # the prose, one directory per chapter group
book/images/         # pictures the prose uses, and the cover
```

`book.config.json` is the only thing the engine needs to learn that is specific
to your book:

```json
{
  "title": "Lorem Ipsum",
  "tagline": "a sample book built by geek-book",
  "cover": "book/images/cover.jpg",
  "docs": ["README.md"]
}
```

Paths default to the layout above (`book/`, `build/html`, `build/book.pdf`,
`book/cover.jpg`); the version is read from the book's own `package.json`.
`npx geek-book config` prints what the engine resolved.

Images are Markdown images, written either from the book root
(`![alt](/images/photo.jpg)`) or relative to the file that carries them
(`![alt](../../images/photo.jpg)`). Both editions resolve them: the website
copies the file into the output tree and rewrites `src`, and the print build
scales each picture to fit the text block. A source that climbs out of the book
directory is a lint error — the web build has nowhere to put it.

A source may also be an `http(s)` URL
(`![alt](https://example.org/photo.jpg)`). The build fetches it once per run into
the build directory and both editions read that copy, so the website ships the
picture with itself and the printed book embeds it. A book that uses remote
images therefore needs the network to build (and so does CI and the pre-commit
hook), which `geek-book lint` reports; a fetch that fails stops the build with
the URL. The print edition reads png and jpeg only — anything else is refused
with a message, since LaTeX cannot embed it.

## Commands

| Command                   | What it does                                              |
| ------------------------- | --------------------------------------------------------- |
| `geek-book web [dir]`     | Build the website.                                        |
| `geek-book pdf [file]`    | Build the PDF (needs LuaLaTeX, `rsvg-convert`, `pdfinfo`).|
| `geek-book serve [dir]`   | Preview the built website.                                |
| `geek-book lint [family]` | Check the tree, the chapters and the links.               |
| `geek-book md <in> <out>` | Render one Markdown file to a standalone page.            |
| `geek-book config`        | Show the book the engine resolved.                        |

`lint` runs three families — `summary`, `chapters` and `links` — and any of them
can be run alone.

## The sample book

This repository builds its own sample: the placeholder book under `book/`, whose
prose is lorem ipsum. It is a fixture, not an example of writing — it exists so
the engine can be built, linted and printed without any other book present.

```
just lint     # type-check the engine, then lint the sample
just html     # build build/html/
just pdf      # build build/book.pdf
just serve    # preview build/html/ on http://localhost:4000
```

The same build runs in Docker with no host setup beyond Docker itself:

```sh
just docker-book
```

## How a book repo consumes it

A book depends on the engine by path and calls its binary from a thin Justfile:

```json
{ "devDependencies": { "geek-book": "file:../geek-book" } }
```

`templates/` holds the book-side files to copy into a new book repository — a
`book.config.json`, a `Justfile`, a compose service for the `book` image, a
pre-commit config and three workflows (lint+build, release, link check) — with
`<owner>`/`<book>` standing in for the GitHub account and repository. See
[`templates/README.md`](./templates/README.md).

## How the engine is tested

The sample under `book/` is the fixture: `just lint`, `just html` and `just pdf`
in this repository exercise the linter and both editions on every change, and CI
runs the same three in the `book` image. There are no unit tests; a book that
builds is the contract.

One check has no source to lint against: whether the printed edition's internal
links land where they claim to. A link whose heading the PDF never labels is not
an error to LaTeX — it reads as unlinked text and the page looks right — so the
PDF build reads the warnings back and fails on any that survive the last pass.

## Layout of this repository

| Path            | What lives there                                                    |
| --------------- | ------------------------------------------------------------------- |
| `bin/`          | The `geek-book` launcher (registers tsx, imports `src/cli.ts`).      |
| `src/lib/`      | Shared pieces: config, paths, Markdown, HTML, code tokenizer, images.|
| `src/build-*`   | The two edition builders (website, LaTeX/PDF).                       |
| `src/lint/`     | Structural checks for the sources.                                   |
| `src/md-to-html/` | The Markdown→HTML renderer, and a one-file CLI.                    |
| `_layouts/`     | The standalone HTML shell (previews and `geek-book md`).             |
| `docker/`       | The build image: Node + LuaLaTeX + the fonts.                        |
| `templates/`    | Book-side scaffolding (config, Justfile, CI) for a new book repo.    |
| `book/`         | The lorem ipsum sample, its `images/` and its cover.                 |

## Licence

MIT (see [LICENSE](LICENSE)). The sample book's prose is placeholder text.
