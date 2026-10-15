# Formatting

*The constructs the engine sets, collected on one page.*

Nothing here is book-specific syntax. The engine typesets ordinary Markdown —
the subset below is everything the guide itself uses — and renders it once for
the website and once for the PDF. Where the two editions differ, the difference
belongs to the medium, not to the source.

## Headings

The title is an `#` heading; sections are `##`, subsections `###`. The printed
edition turns them into chapter and section headings; the website uses them for
anchors and the table of contents.

## A table

| Construct | Website | PDF | Note |
| --- | --- | --- | --- |
| Paragraph | wraps | ragged right | the unit of everything |
| Table | scrolls | fixed | keep the cells short |
| Quote | styled | callout panel | for asides and warnings |
| Diagram | inline SVG | figure | one source, two renderings |

Tables are pipes and a rule, and the align row is optional. The linter allows a
table row up to 240 columns, wider than prose, because a comparison table is
often the point of the page.

## A quote

> A quotation is a callout panel in the printed edition and a styled block on the
> website. Use it for the aside that is not part of the argument.

## Lists

Bulleted and numbered lists both work, and both nest:

1. The summary fixes the chapter order.
2. The prose is rendered, once per edition.
3. The print build binds the pages together.

- a bullet,
- another bullet,
  - and a nested one.

## Inline markup

Text may be *emphasised*, **bold**, or `code`. A link to [a heading on this
page](#a-table) is an anchor; a link to [another chapter](03_chapters.md) is a
relative path. A link that leaves the book keeps its address: [the CommonMark
spec](https://commonmark.org/) is off the site and out of the PDF. The site
hands the address to the browser, the printed page marks it as a link that
leaves the book, and the link check is what actually visits it.
