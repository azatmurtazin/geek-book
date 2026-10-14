# Formatting

*Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.*

The engine typesets ordinary Markdown. Nothing here is book-specific syntax: it
is headings, lists, tables, quotes and code, rendered once for the website and
once for the PDF.

## One of everything

[A sample page](01_sample_page.md) collects a table, a quote, a numbered list, an
anchor link, a link off the site and a couple of fenced blocks on a single
screen.

## Fenced blocks are always tagged

A fence without a language is an error, and a tag the book has not declared is a
warning. A book that writes about Go and Rust lists them in `book.config.json`;
this sample keeps the engine's default list.

```text
geek-book lint     # check the tree
geek-book web      # build the website
geek-book pdf      # build the print edition
```
