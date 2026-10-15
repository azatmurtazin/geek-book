# Writing

*The tree, the summary and the prose the engine typesets.*

A book is ordinary Markdown in a conventional tree. The engine adds no
book-specific syntax: headings, lists, tables, quotes, links and fenced code are
the whole vocabulary, rendered once for the website and once for the PDF.

What the engine does care about is structure. The tree decides what is a book
page and what is an asset; `SUMMARY.md` decides the order; each chapter opens
with exactly one title. The linter checks all of it before either edition is
built, so a broken link or an untagged fence is a message rather than a surprise
in the printed copy.

## In this section

- [The book tree](01_tree.md) — the files the engine reads, and what each is
  for.
- [SUMMARY.md](02_summary.md) — groups, chapters and the order they appear in.
- [Chapters](03_chapters.md) — one title per file, headings, links and
  placeholders.
- [Formatting](04_formatting.md) — the constructs the engine can set.
- [Code](05_code.md) — fenced blocks, languages and highlighting.
