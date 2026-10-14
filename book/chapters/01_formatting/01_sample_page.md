# A sample page

*Duis aute irure dolor in reprehenderit in voluptate velit esse cillum.*

Everything on this page is here so that the build has one of each construct to
set, on both editions.

## A table

| Element   | Website    | PDF       | Notes                      |
| --------- | ---------- | --------- | -------------------------- |
| Paragraph | wrapping   | justified | the unit of everything     |
| Table     | scrolls    | fixed     | keep the cells short       |
| Diagram   | inline SVG | figure    | one source, two renderings |

## A quote and a list

> Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia
> deserunt mollit anim id est laborum.

1. The summary fixes the chapter order.
2. The prose is rendered, once per edition.
3. The print build binds the pages together.

## An anchor

Link to [the table above](#a-table) or to the
[introduction](../00_intro/00_index.md).

## An external link

Not every link stays inside the book: [the CommonMark
spec](https://commonmark.org/) is off the site and out of the PDF. The site hands
the address to the browser, the printed page marks it as a link that leaves the
book, and the link check is what actually visits it.

```python
def lorem(words: int = 3) -> str:
    """Return a few words of nothing in particular."""
    return " ".join(["lorem", "ipsum", "dolor"][:words])
```

Back to [formatting](00_index.md).
