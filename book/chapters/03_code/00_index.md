# Code

*Lorem ipsum dolor sit amet, consectetur adipiscing elit.*

Fenced code is syntax-highlighted with a small tokenizer the engine carries for
each declared language. The highlight colours live in one stylesheet shared by
the website and the standalone page layout, so the two cannot drift.

```js
const book = {
  title: "Lorem Ipsum",
  languages: ["js", "python", "text"],
};

export function describe() {
  return `${book.title}: ${book.languages.length} languages`;
}
```

The sample ends here; [Formatting](../01_formatting/00_index.md) has the rest of
the constructs the engine can set.
