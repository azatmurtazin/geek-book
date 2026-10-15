# Linting

*What the engine checks before it builds, and why.*

`geek-book lint` reads the sources the way the builders will and reports what
would go wrong. It runs three families of check — `summary`, `chapters` and
`links` — and any of them can be run alone. The split matters because a book can
be wrong in three independent ways: the tree, the prose, and the references
between them.

## summary

The tree against the prose:

- every Markdown file under `book/chapters/` is listed in `SUMMARY.md`;
- every entry points at a file that exists — one that is planned but not written
  is a note, not an error, because the tree may run ahead of the prose;
- a section is indented under a chapter of the same group;
- every chapter group has its `00_index.md`.

## chapters

The prose itself:

- exactly one `#` title, on the file's first line, with no skipped heading level;
- every fenced block is tagged with a language — a language outside the declared
  set is a warning;
- a `text` or `ascii` fence stays within the 80-column print budget;
- no tabs, no trailing whitespace, a trailing newline, and prose lines inside
  100 columns — unless the line carries a run too long to wrap, such as a URL,
  which no amount of editing could bring inside the budget.

## links

Internal references:

- every relative link points at a file that exists;
- every `#anchor` names a heading in its target, using the same slug rule the
  website uses, so a link that lints clean lands in the right place in both
  editions.

External `http(s)` links are left to the build's link check — `lychee` in the
book templates — which actually visits them, and reports the ones that have gone
dead.
