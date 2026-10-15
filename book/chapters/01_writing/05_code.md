# Code

*Fenced blocks, language tags and the highlighting both editions share.*

Code is written like any other block: three backticks, the language, the code,
three backticks. The tag is not a hint to an editor — it is what the linter
checks the fence against, what the label in the corner says, and what the
highlighter tokenises the block for.

## Always tag the fence

A fence with no language is an error:

```python
def describe(book: str) -> str:
    """Return a one-line description of a book."""
    return f"{book}: a book built with geek-book"
```

The tokenizer knows the language the tag names: keywords, strings, comments and
numbers are coloured from one stylesheet shared by the website and the
standalone page layout, so the two cannot drift. The label in the top-right
corner comes from the same tag — `python` shows as "Python", `js` as
"JavaScript".

## Declared languages

The linter accepts a generous set out of the box: the prose languages, shells,
the data formats and the common platform languages. A tag outside that set is a
warning, not an error, and the fix is to declare it. A book that writes about Go
and Rust names them in `book.config.json`:

```json
{
  "languages": ["go", "rust", "text", "markdown", "mermaid"]
}
```

Setting `languages` replaces the default set, so a book that names its own list
should include the tags it still uses — `text` for pasted output, and `mermaid`
for diagrams.

`languages` is only the fence set. The book's own language is the separate
`language` key in [Configuration](../03_config/00_index.md); `languages` never
changes how the prose itself is set.

## Pasted output

A `text` fence is for output rather than source: a command transcript, a log
excerpt, a small ASCII diagram. It is not highlighted, and it has to fit the
print column — 80 columns wide:

```text
$ geek-book lint
9 chapter file(s), 0 error(s), 0 warning(s)
```

A `mermaid` fence is a diagram of its own, and gets [its own
section](../02_media/03_diagrams.md).
