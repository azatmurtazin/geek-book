# Introduction

*What geek-book is, and how to read this guide.*

geek-book is a build engine for books. You write the prose in Markdown, keep it
in a conventional directory, and the engine produces two editions from the same
sources: a static website you can serve from any file host, and a print-ready
PDF you can send to a printer or a reader.

There is no database, no templating language and no separate build tool. A book
is a directory of text files, and the engine is the program that reads them.
This guide documents version {{ version }}.

## The two editions

One source, two renderings. The website is plain HTML and CSS with a single
small script that handles the day/night switch and the folding sidebar; the
printed edition is LaTeX, typeset by LuaLaTeX, with the page geometry, the
palette and the type scale all under the book's control.

The editions share more than the prose. A heading gets the same anchor in both,
so a link names the same place on the site and on the page; code is coloured by
one shared stylesheet; a diagram is drawn once and embedded inline in one
edition and as a figure in the other.

## What a book looks like

Everything the engine needs sits in a conventional tree:

- **`book.config.json`** names the book and points the engine at its sources.
- **`book/SUMMARY.md`** is the table of contents and the chapter order.
- **`book/chapters/`** holds the prose, one directory per chapter group.
- **`book/README.md`** becomes the website's front page.
- **`book/images/`** holds the pictures the prose uses, and the cover.

## How to read this guide

After [Installing geek-book](01_installing.md) and [Your first
book](02_first_book.md), the sections follow the order you meet them:

- [Writing](../01_writing/00_index.md) — the tree, the summary, chapters, code.
- [Media](../02_media/00_index.md) — images and diagrams.
- [Configuration](../03_config/00_index.md) — the full `book.config.json`.
- [Publishing](../04_publishing/00_index.md) — commands, linting and CI.
