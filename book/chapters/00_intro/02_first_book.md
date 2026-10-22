# Your first book

*From an empty directory to a website and a bound PDF.*

A book is the directory the engine runs from. There is no scaffolding command:
you make the directory, write one configuration file and a handful of Markdown,
and the engine takes it from there. The engine's `templates/` directory holds
copies of the files a new book starts from — a configuration, a Justfile, a
compose service, a pre-commit config and the CI workflows.

## Make the tree

```text
my-book/
  book.config.json
  package.json
  book/
    SUMMARY.md
    README.md
    chapters/
    images/
```

`book.config.json` is the only file specific to your book:

```json
{
  "title": "My Book",
  "tagline": "a book built with geek-book",
  "author": "Me"
}
```

Everything else has a default that fits the layout above: the sources under
`book/`, the website in `build/html` and the PDF in `build/book.pdf`. The title
is the one key the file should carry.

## Write the contents

`book/SUMMARY.md` is the table of contents and the chapter order. Start it with
one group and one chapter:

```md
# Summary

# Getting started

- [Getting started](chapters/00_start/00_index.md)
```

Then `book/chapters/00_start/00_index.md` holds the prose, opening with its
title:

```md
# Getting started

The first page of a new book.
```

`book/README.md` becomes the website's front page; point it at the chapter and
say what the book is.

## Build it

Three commands do the work, and a fourth adds the print edition:

```sh
npx geek-book lint   # check the tree and the prose
npx geek-book web    # write build/html/
npx geek-book serve --watch  # preview and rebuild on saves
npx geek-book pdf    # write build/book.pdf
```

That is the whole loop. Everything after this page refines one part of it: the
tree, the prose, the pictures, the configuration, and how a book ships.
