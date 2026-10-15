# SUMMARY.md

*The table of contents, and the order the chapters are bound in.*

`book/SUMMARY.md` is the single source of truth for what the book contains. The
engine numbers the chapters, builds the website's sidebar and typesets the book
from this file alone, so a chapter that is not listed here is not in either
edition — and the linter says so.

## The shape of the file

The first heading is the file's own title and is ignored. Every heading after it
opens a group; every list item is a chapter, with a label and the path to its
file:

```md
# Summary

# Getting started

- [Getting started](chapters/00_start/00_index.md)
  - [Installing](chapters/00_start/01_installing.md)
  - [Your first book](chapters/00_start/02_first_book.md)

# Reference

- [Reference](chapters/01_reference/00_index.md)
```

The indent is what makes the second and third entries sections of the group
rather than chapters of their own; they still become pages, nested under the
first. The path is relative to `book/` and ends in `.md`.

## The rules

The linter's `summary` family checks the tree against the prose:

- every Markdown file under `book/chapters/` is listed here, and every entry
  points at a file that exists — a listed file that is not written yet is a
  note, not an error, since the tree is allowed to run ahead of the prose;
- a section is indented under a chapter of the same group, never under nothing;
- every chapter group directory holds a `00_index.md`, the group's own page.

Group headings and the order of the list are also the running order of the
printed book and the order of the sidebar on the site. Moving a list item moves
the chapter in both editions.

## Labels

The label in brackets is what the table of contents, the sidebar and the running
heads show. It does not have to match the file's own `# Heading`, though keeping
the two close spares the reader two names for one page.
