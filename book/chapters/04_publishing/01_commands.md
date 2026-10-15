# Commands

*Every command the engine carries.*

The engine is one binary with a handful of subcommands. All of them run from the
book root and read `book.config.json` there; most take an optional path.

| Command | What it does |
| --- | --- |
| `geek-book web [dir]` | Build the website (default: `build/html`). |
| `geek-book pdf [file]` | Build the PDF (default: `build/book.pdf`). |
| `geek-book serve [dir] [port]` | Preview the built site (default: web output, 4000). |
| `geek-book lint [family…]` | Check the sources: `summary`, `chapters`, `links`. |
| `geek-book md <in> [out]` | Render one Markdown file to a standalone page. |
| `geek-book pdf-info <pdf>` | Page count, size and friends, via poppler. |
| `geek-book config` | Print the resolved book configuration. |

## Building

`web` and `pdf` write their output and nothing else. Both are safe to run again,
and both overwrite what was there. `serve` previews the built site rather than
rebuilding it, so run a build first:

```sh
geek-book web build/html
geek-book serve build/html 4000
```

`md` renders a single file outside any book, through the same Markdown renderer
and the standalone page layout. It is how a chapter looks on its own, without
the sidebar.

## Checking

`lint` runs three families and can run them one at a time:

```text
geek-book lint            # all three
geek-book lint links      # just the link check
```

It exits non-zero on an error and writes a summary line. Warnings — an unusual
fence language, a group with no index page — do not fail the build. [Linting](02_lint.md)
has the details.

## Inspecting

`config` prints everything the engine resolved, defaults and overrides alike. It
is the fastest way to answer "what did that setting actually do?", and it is what
a bug report should carry. `pdf-info` is a thin wrapper over poppler's `pdfinfo`,
for the page count and page size of a finished PDF.
