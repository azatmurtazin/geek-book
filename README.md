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
  "title": "geek-book",
  "tagline": "the user's guide",
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
embeds it at the size the website gives it — 96 pixels to the inch — shrinking
it to the text block only when it would not fit, so a small picture is never
stretched across the page. A source that climbs out of the book directory is a
lint error — the web build has nowhere to put it.

A source may also be an `http(s)` URL
(`![alt](https://example.org/photo.jpg)`). The build fetches it once per run into
the build directory and both editions read that copy, so the website ships the
picture with itself and the printed book embeds it. A book that uses remote
images therefore needs the network to build (and so does CI and the pre-commit
hook), which `geek-book lint` reports; a fetch that fails stops the build with
the URL. The print edition reads png and jpeg only — anything else is refused
with a message, since LaTeX cannot embed it.

The two editions are set in the families `book.config.json` names under `fonts`:
`text` for the body, the headings and the diagrams, `code` for code. They
default to Literata and JetBrains Mono, so a book that does not care says
nothing:

```json
{
  "fonts": {
    "text": "Literata",
    "code": "JetBrains Mono",
    "bold": "Literata:mode=harf;wght=700",
    "web": "https://fonts.googleapis.com/css2?family=…&display=swap"
  }
}
```

The website and the standalone previews load the families from `fonts.web` — a
stylesheet, usually a Google Fonts URL — while the printed edition asks the
build machine for the family by name, so the fonts have to be installed where
the PDF is built, and the engine's Docker image carries the defaults. Two
defaults belong to the default families and travel with them: the built-in
stylesheet asks Google for Literata and JetBrains Mono, and `fonts.bold` names
Literata's bold as a fontspec declaration (`Family:options`). A book that names
its own families therefore starts with no webfont and its families' own bold —
it names a stylesheet under `web` (or `""` for none) when the site should load
them, and spells out `bold` when bold is a weight instance of a variable font
rather than a face of its own.

The printed edition has a `tex` block of its own. Nothing in it is required —
the defaults are the engine's:

```json
{
  "tex": {
    "geometry": { "paper": "a4", "top": 19, "bottom": 19, "left": 18, "right": 18 },
    "colors": { "fg": "#242a37", "muted": "#667085" },
    "type": { "base": 11, "chapter": 20, "section": 15 }
  }
}
```

`geometry` is a paper — `a4`, `a5`, `letter` or `legal` — and four margins in
millimetres. The text block pictures are scaled against is derived from those,
so a book that changes its page changes what fits with it and says nothing
else. `colors` is the palette as `#rrggbb`: `fg`, `muted`, `rule`,
`codeBackground`, `codeForeground`, `codeComment`, `calloutBackground`,
`calloutBorder` and `calloutForeground`. `type` is the heading scale in points,
where `base` is the document class size (10, 11 or 12) and a heading's leading
is its size times 1.2, rounded up. Any key may be left out; the engine's
defaults stand in.

For anything those knobs do not reach, `tex.preamble` names a file of plain
LaTeX, relative to the book root, that is appended after the built-in preamble
and before `\begin{document}` — a book can redefine what the engine ships
without copying it:

```tex
% tex/book.tex
\renewcommand{\pefolio}{\fontsize{9}{11}\selectfont\color{muted}\thepage}
\titleformat{\chapter}[block]{\normalfont\LARGE\bfseries\color{fg}}{}{0em}{}
```

Both are print-only: the website's look is CSS, so these settings never touch
the HTML. `npx geek-book config` prints everything the engine resolved.

The website carries the one script the engine ships: it puts the reader's
day/night choice — their system preference on a first visit, remembered in local
storage from then on — and their folded panel on `<html>` before the first
paint, then wires the two header controls that flip them. The rest of the page
needs no JavaScript. A SUMMARY group folds because it is a `<details>` — the
group the current page belongs to arrives open, so a long book shows its parts
rather than every one of its chapters at once — and the header's hamburger folds
the whole panel away, handing the window to the text and centring the reading
column. With scripts off that hamburger still folds the panel, for the page in
hand, and the theme button stays out of the way.

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

## This book

This repository builds its own book: the user's guide under `book/`, which
documents the engine and doubles as the fixture it is tested against. It is
written the way any book is, so nothing about the build is exercised only by
content that lives somewhere else.

```
just lint     # type-check the engine, then lint the book
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

The book under `book/` is the fixture: `just lint`, `just html` and `just pdf`
in this repository exercise the linter and both editions on every change, and CI
runs the same three in the `book` image. There are no unit tests; a book that
builds is the contract.

One check has no source to lint against: whether the printed edition's internal
links land where they claim to. A link whose heading the PDF never labels is not
an error to LaTeX — it reads as unlinked text and the page looks right — so the
PDF build reads the warnings back and fails on any that survive the last pass.

## Layout of this repository

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

CSS is plain `.css` rather than a preprocessor: the stylesheets sit beside the
code that reads them (`src/build-web-book/site.css`, `src/lib/content.css`) and
are pasted into the page at build time, so there is no CSS build step and an
editor can highlight the styles in full. The printed edition's preamble is
plain `.tex` for the same reason: `src/build-tex-book/preamble.tex` sits beside
the loader that fills it from the config.

## Licence

MIT (see [LICENSE](LICENSE)).
