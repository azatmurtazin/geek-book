# Commands

*Every command the engine carries.*

The engine is one binary with a handful of subcommands. All of them run from the
book root and read `book.config.json` there; most take an optional path. A
`--config <file>` option, written anywhere on the line, builds the book beside
that config file instead.

| Command | What it does |
| --- | --- |
| `geek-book web [dir]` | Build the website (default: `build/html`). |
| `geek-book pdf [file]` | Build the PDF (default: `build/book.pdf`). |
| `geek-book serve [dir] [port] [--watch]` | Preview the built site (default: web output, 4000); `--watch` rebuilds on saves. |
| `geek-book lint [family…]` | Check the sources: `summary`, `chapters`, `links`, `config`. |
| `geek-book md <in> [out]` | Render one Markdown file to a standalone page. |
| `geek-book pdf-info <pdf>` | Page count, size and metadata, via poppler. |
| `geek-book config` | Print the resolved book configuration. |

## Choosing the book

By default the book is the directory the command runs from. `--config <file>`
names another `book.config.json`, and the book becomes the directory holding it:
the sources, the `package.json` the version is read from, and the default output
paths are all resolved there.

```sh
geek-book --config ../my-book/book.config.json web
geek-book web --config ../my-book/book.config.json
```

The option may sit before or after the command — the two lines above are the
same — and the file it names must exist.

## Building

`web` and `pdf` write their output and nothing else. Both are safe to run again,
and both overwrite what was there. `serve` previews the built site rather than
rebuilding it, so run a build first:

```sh
geek-book web build/html
geek-book serve build/html 4000
```

With `--watch`, `serve` builds the website first, then watches the book sources
and rebuilds after each save. The preview directory is the one you named (or the
website output by default), so the same command works from a clean checkout:

```sh
geek-book serve --watch
just serve --watch
```

`--watch` watches the Markdown and assets under the book directory, plus any
configured stylesheet, head file, favicon, summary or readme that lives outside
it. Writes under the output directory are ignored, so a rebuild does not trigger
itself. If the first build fails, the command exits with its diagnostics before
serving; a rebuild that fails after that prints the diagnostics and leaves the
server running, so fixing the source and saving again is enough. Changes to
`book.config.json` need a restart,
because the Markdown parser, diagram theme and image limits are built from those
settings once. Ctrl-C stops the preview.

A missing directory, an invalid port or a port already in use is one `serve:`
line and exit status 1, not a stack trace. Port `0` asks the kernel for a free
port, and the printed URL names the port it chose. The server answers `GET` and
`HEAD` only; it refuses a path that leaves the site through `..` or a symlink.

`md` renders a single file outside any book, through the same Markdown renderer
and the standalone page layout. It is how a chapter looks on its own, without
the sidebar.

## Checking

`lint` runs four families and can run them one at a time:

```text
geek-book lint            # all four
geek-book lint links      # just the link check
```

It exits non-zero on an error and writes a summary line. Warnings — an unusual
fence language, a group with no index page — do not fail the build. [Linting](02_lint.md)
has the details.

## Inspecting

`config` prints everything the engine resolved, defaults and overrides alike. It
is the fastest way to answer "what did that setting actually do?", and it is what
a bug report should carry. `pdf-info` is a thin wrapper over poppler's `pdfinfo`,
for the metadata, page count and page size of a finished PDF.
