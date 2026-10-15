# Fonts

*The families both editions are set in, and how each edition finds them.*

A book is set in two families: one for the text, the headings and the diagrams,
one for code. A book names families, never files. The website loads them from a
stylesheet, and the printed edition asks the build machine for them by name,
which is why the print toolchain wants the fonts installed there.

## The defaults

```json
{
  "fonts": {
    "text": "Literata",
    "code": "JetBrains Mono",
    "bold": "Literata:mode=harf;wght=700",
    "web": "https://fonts.googleapis.com/css2?family=Literata&family=JetBrains+Mono&display=swap"
  }
}
```

The built-in stylesheet asks Google for Literata and JetBrains Mono, and the
Docker image ships both, so a book that says nothing gets the two editions set
in the same type.

## Naming your own families

A book that names its own `text` and `code` starts with no webfont and its
families' own bold — the two defaults belong to the default families and travel
with them. Name a stylesheet under `web` when the site should load the new
families (or `""` for none):

```json
{
  "fonts": {
    "text": "Source Serif 4",
    "code": "IBM Plex Mono",
    "web": "https://fonts.googleapis.com/css2?family=Source+Serif+4&family=IBM+Plex+Mono&display=swap"
  }
}
```

The printed edition still asks the system for "Source Serif 4" and "IBM Plex
Mono", so those families have to be installed where the PDF is built.

## Bold, when the family has no face of its own

`bold` spells the text family's bold as a fontspec declaration
(`Family:options`). It matters when bold is a weight instance of a variable font
— as it is for Literata — rather than a face of its own: fontconfig then reports
no bold for the family, and the declaration tells LuaLaTeX which instance to
use. Leave `bold` out (or empty) to take the family's own bold.
