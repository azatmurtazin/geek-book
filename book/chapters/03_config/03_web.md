# The website

*What the site says about itself, and the stylesheet and head HTML it adds to
the built-in look.*

The printed edition's knobs live under `tex`; the website's are their mirror
under `web`. Some say what the site *is* — its address, its description, its
favicon — and some change how it *looks*: the site's appearance is CSS, so a book
changes it the way any site does, with a stylesheet of its own. `geek-book config`
prints every resolved value.

## The site's address

`web.baseUrl` is where the site is published. An absolute URL also gives every
page a canonical address and the social card tags a link preview reads:

```json
{
  "web": { "baseUrl": "https://example.com/book/" }
}
```

The home page's canonical is the base URL itself; a chapter's is the base with
the page's output path appended:

```text
https://example.com/book/chapters/01_writing/01_tree.html
```

A root-relative path (`/book/`) instead only sets the base path, for a site whose
host is not known at build time; then no canonical is written. Either way the
base path keeps the site's root links on the site rather than on the host's root
— the standalone page's brand and Home links, in particular. With no base URL
both are `/`, which is the common case.

## Description and cards

`web.description` is the one line search engines and social cards show. It
defaults to the `tagline`:

```json
{
  "web": { "description": "Build a book from Markdown, website and all." }
}
```

Every page carries it as a `description` meta tag and in the Open Graph and
Twitter card tags, with the page title, the book title as the site name, and the
author when the config names one. The canonical address joins them when
`baseUrl` is absolute. The card's image is not a key — `web.head` is the place
for one, and for anything else the engine does not know.

## Favicon

`web.favicon` names a file, relative to the book root, that the build copies
into the site and links from every page:

```json
{
  "web": { "favicon": "web/icon.png" }
}
```

## Footer links

`web.links` is a list of labelled links the site's footer carries, in order — a
repository, a licence, anything:

```json
{
  "web": {
    "links": [
      { "label": "Source", "href": "https://github.com/me/book" },
      { "label": "Edit this page", "href": "https://github.com/me/book/edit/main/{path}" }
    ]
  }
}
```

Two placeholders make a link follow the page: `{path}` is the source file's path
from the book root (`book/chapters/01_writing/01_tree.md`) and `{url}` is the
page's absolute address, when `baseUrl` gives one. The first link above is the
same everywhere; the second opens an editor on the page being read.

## Extra CSS

`web.css` names a file of CSS, relative to the book root, appended after the
engine's stylesheet:

```json
{
  "web": { "css": "web/book.css" }
}
```

It comes last, so it wins wherever it overlaps — the built-in rules are
defaults, not a fence. A book can narrow the reading column, restyle the
sidebar, or repaint the palette by redefining the custom properties the
stylesheet opens with:

```css
/* web/book.css */
:root { --accent: #b3461f; }
.book-body { max-width: 40rem; }
```

The palette is shared: the website's light colours come from `tex.colors`, the
same nine the printed page uses, so a book's palette reaches both editions. The
rest of the site's `:root` — its accent, its page and sidebar backgrounds — is
the website's own. This file can override any of it, the shared palette
included. The reader's night theme is the engine's and does not follow
`tex.colors`.

## Extra head HTML

For a meta tag, a social image or an analytics snippet, `web.head` names a file
of HTML injected into every page's `<head>`, after the stylesheet link:

```json
{
  "web": { "head": "web/head.html" }
}
```

```html
<!-- web/head.html -->
<meta property="og:image" content="https://example.com/book/card.png">
```

The two files above name plain files relative to the book root, the web's
counterpart to `tex.preamble`, and they come last, so they can add to or override
what the engine emits. The stylesheet, the head HTML, the favicon and the footer
links do not reach the standalone page the `md` command renders, which keeps its
own layout; that page does read `baseUrl` and `description`, so its root links
and meta tags match the site.
