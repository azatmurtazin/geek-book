# The printed page

*Geometry, palette, type scale — and a file of LaTeX for anything else.*

Everything about the printed edition that a book is likely to change lives under
`tex` in `book.config.json`. None of it touches the website, whose look lives in
CSS; these settings are the PDF's alone. `geek-book config` prints every
resolved value.

## The page

```json
{
  "tex": {
    "geometry": { "paper": "a4", "top": 19, "bottom": 19, "left": 18, "right": 18 }
  }
}
```

`paper` is one of `a4`, `a5`, `letter` or `legal`, and the four margins are
millimetres. The text block the print build measures pictures against is derived
from these, so a book that changes its page changes what fits with it and says
nothing else.

## The palette

Nine colours, each `#rrggbb`:

| Key | What it colours |
| --- | --- |
| `fg` | the body text, headings and links |
| `muted` | folios, running heads and secondary text |
| `rule` | hairlines: heading rules, the code panel's border |
| `codeBackground` | the code panel's fill |
| `codeForeground` | code text |
| `codeComment` | comments inside code |
| `calloutBackground` | the callout panel's fill |
| `calloutBorder` | the callout's accent bar |
| `calloutForeground` | the text inside a callout |

## The type scale

```json
{
  "tex": {
    "type": { "base": 11, "chapter": 20, "section": 15, "subsection": 12.5 }
  }
}
```

`base` is the document class size — 10, 11 or 12 — and the rest are heading
sizes in points. A heading's leading is its size times 1.2, rounded up. Any key
may be left out; the engine's defaults stand in.

## Anything else: a preamble file

For what the knobs do not reach, `tex.preamble` names a file of plain LaTeX,
relative to the book root, appended after the built-in preamble and before
`\begin{document}`:

```text
% tex/book.tex
\renewcommand{\pefolio}{\fontsize{9}{11}\selectfont\color{muted}\thepage}
\titleformat{\chapter}[block]{\normalfont\LARGE\bfseries\color{fg}}{}{0em}{}
```

That file can redefine what the engine ships without copying it. The example
resets the folio and redefines the chapter format — the sort of change the
config keys do not expose.
