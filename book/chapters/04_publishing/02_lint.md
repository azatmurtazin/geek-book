# Linting

*What the engine checks before it builds, and why.*

`geek-book lint` reads the sources the way the builders will and reports what
would go wrong. It runs four families of check — `summary`, `chapters`, `links`
and `config` — and any of them can be run alone. The split matters because a book
can be wrong in independent ways: the tree, the prose, the references between
them, and the configuration itself.

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
- a `text` or `ascii` fence stays within the print budget, 80 columns by default;
- no tabs, no trailing whitespace, a trailing newline, and prose lines inside
  the prose budget, 100 columns by default — unless the line carries a run too
  long to wrap, such as a URL, which no amount of editing could bring inside the
  budget.

The three budgets — prose, table row and diagram — are the `lint` block in
`book.config.json`; see [Configuration](../03_config/00_index.md).

## links

Internal references:

- every relative link points at a file that exists;
- every `#anchor` names a heading in its target, using the same slug rule the
  website uses, so a link that lints clean lands in the right place in both
  editions.

External `http(s)` links are left to the build's link check — `lychee` in the
book templates — which actually visits them, and reports the ones that have gone
dead.

## config

The configuration file, against the schema the engine ships:

- an unknown key is a warning — the engine ignores it, so it is usually a typo
  for a key that exists;
- a value the engine would reject and replace with its default — a paper that is
  not `a4`, `a5`, `letter` or `legal`, a colour that is not `#rrggbb`, a base size
  that is not 10, 11 or 12 — is a warning too;
- a file that does not parse as JSON is a warning, because the engine would
  otherwise build the defaults without a word.

Every finding here is advisory: the engine treats each key as optional and falls
back to a default, so a warning never fails the build. The check reads
`book.schema.json`, the same schema an editor reads through the config's
`$schema` key, so the two can never disagree.
