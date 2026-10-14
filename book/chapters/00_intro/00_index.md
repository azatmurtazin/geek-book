# How this sample is put together

*Lorem ipsum dolor sit amet, consectetur adipiscing elit.*

This repository *is* the engine: `geek-book` turns a directory of Markdown — plus
a small `book.config.json` — into a website and a print-ready PDF. The sample
under `book/` is deliberately tiny, but it is built the same way a real book is,
so the build is never exercised only by content that lives somewhere else.

## The shape of a book

Everything the engine needs sits in a conventional tree:

- **`book.config.json`** names the book — its title, its tagline and, when the
  defaults do not fit, where the sources and the outputs live.
- **`book/SUMMARY.md`** is the table of contents and the chapter order.
- **`book/chapters/`** holds the prose, one directory per chapter group.
- **`book/README.md`** becomes the website's front page.

Then three commands do the work: `geek-book lint` checks the tree, `geek-book
web` writes the site and `geek-book pdf` typesets the book.

## Where to look next

[What lorem ipsum is for](01_what_is_lorem.md) explains the placeholder text, and
[Formatting](../01_formatting/00_index.md) shows what the engine can typeset.
