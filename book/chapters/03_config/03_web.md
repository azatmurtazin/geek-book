# The website

*A stylesheet and head HTML the site adds to the built-in look.*

The printed edition's knobs live under `tex`; the website's are their mirror
under `web`. The site's look is CSS, so a book changes it the way any site does:
with a stylesheet of its own. `geek-book config` prints both files.

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

The two editions carry separate palettes: `tex.colors` is the printed edition's,
and the `:root` variables are the website's. This file reaches the second, not
the first.

## Extra head HTML

For a meta tag, a favicon or an analytics snippet, `web.head` names a file of
HTML injected into every page's `<head>`, after the stylesheet link:

```json
{
  "web": { "head": "web/head.html" }
}
```

```html
<!-- web/head.html -->
<meta name="theme-color" content="#b3461f">
```

Both keys name files relative to the book root — the same shape as
`tex.preamble`, rather than a string pasted into the config, so the markup and
the CSS keep their own file and their own editor. Both are optional, and neither
touches the standalone page the `md` command renders, which has its own layout.
