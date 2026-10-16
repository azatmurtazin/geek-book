# Configuration

*book.config.json: what it sets, and what it leaves to the defaults.*

The engine learns everything specific to a book from one file at the book root.
Nothing in it is required except, in practice, a title, and every value has a
default that fits the conventional layout. `geek-book config` prints the whole
resolved configuration — every default and every override — which is the fastest
way to see what a setting actually did.

The file's shape is described by `book.schema.json`, which ships with the engine.
An editor reads it through the config's `$schema` key, and `geek-book lint config`
checks the file against it — the same schema, so the two can never disagree.

## A complete example

```json
{
  "$schema": "./book.schema.json",
  "title": "My Book",
  "tagline": "a book built with geek-book",
  "author": "Me",
  "version": "1.2.0",
  "bookDir": "book",
  "output": { "web": "build/html", "pdf": "build/book.pdf" },
  "docs": ["README.md"],
  "languages": ["js", "ts", "python", "text", "markdown", "mermaid"],
  "fonts": { "text": "Literata", "code": "JetBrains Mono" },
  "tex": {
    "geometry": { "paper": "a5", "top": 16, "bottom": 16, "left": 14, "right": 14 },
    "type": { "base": 10 }
  }
}
```

## The keys

| Key | Default | What it is |
| --- | --- | --- |
| `title` | the package name | The book's title, on the site and the cover. |
| `tagline` | none | A one-line subtitle. |
| `author` | none | The author's name, for the colophon. |
| `version` | the package version | What the version token resolves to in the prose. |
| `placeholders` | none | A book's own prose tokens, beyond `version`, `title`, `author` and `tagline`. |
| `language` | `en` | The book's language, a BCP 47 tag such as `de` or `pt-BR`. |
| `strings` | English | Overrides for the fixed interface labels. |
| `bookDir` | `book` | Where the sources live. |
| `summary` | `<bookDir>/SUMMARY.md` | The table of contents the build follows. |
| `chapters` | `<bookDir>/chapters` | The directory the chapter prose lives in. |
| `readme` | `<bookDir>/README.md` | The website's home page. |
| `output.web` | `build/html` | Where the website is written. |
| `output.pdf` | `build/book.pdf` | Where the PDF is written. |
| `docs` | `README.md`, `CONTRIBUTING.md` | Root Markdown whose links are linted. |
| `languages` | the built-in set | Fence languages the linter accepts. |
| `code` | none | Labels and comment styles for a book's own languages. See [Code](../01_writing/05_code.md). |
| `lint` | 100 / 240 / 80 | Line budgets the chapter check enforces. |
| `markdown.smartTypography` | off | Curly quotes and en/em dashes in the prose. See [Formatting](../01_writing/04_formatting.md). |
| `fonts` | Literata, JetBrains Mono | See [Fonts](01_fonts.md). |
| `tex` | the engine's page | See [The printed page](02_print.md). |
| `web` | none | The site's metadata, stylesheet and `<head>` HTML. See [The website](03_web.md). |
| `web.baseUrl` | none | The site's base URL, for root links and canonical tags. |
| `web.description` | the tagline | What search engines and social cards show. |
| `web.favicon` | none | The site's favicon. |
| `web.links` | none | Labelled links the site's footer carries. |

The version is read from the book's own `package.json` unless the config names
one, so the number still lives in exactly one place. `docs` exists because a
book repo holds Markdown outside `book/` — a README, a changelog — whose links
the linter should resolve just the same.

## Sources

The summary, the chapter prose and the website's front page default to
`book/SUMMARY.md`, `book/chapters/` and `book/README.md`. Each moves with its own
key — `summary`, `chapters` and `readme`, all relative to the book root — and the
build, the linter and the server follow. The chapter paths inside SUMMARY.md stay
relative to the book directory, so a book that moves `chapters` updates them to
match; the `summary` check names any that do not. With no `readme` file, the
website's home page is a redirect to the first chapter.

## Language

`language` is the book's own language, a BCP 47 tag such as `en`, `en-GB`, `de`
or `pt-BR`. It sets the website's `lang` attribute, so a browser and a screen
reader treat the prose as that language, and it tells the printed edition which
hyphenation patterns to use. English is LaTeX's own default and needs nothing; a
book that names another language has to have that language's babel files
installed where the PDF is built. A tag the engine does not recognize keeps the
English patterns.

The interface around the prose stays English until the book says otherwise. The
`strings` map overrides the labels the two editions print — `previous`, `next`,
`contents` (the table of contents heading), `home`, and the two controls'
names:

```json
{
  "language": "de",
  "strings": { "previous": "Zurück", "next": "Weiter", "contents": "Inhalt" }
}
```

`contents` is the printed table of contents' heading; leave it out and a language
the engine loads keeps the caption babel gives it, in that language's words —
English, which loads no babel, keeps the engine's name. The other labels are the
website's, with `home` on the standalone rendered page.

This key is not the linter's [`languages`](../01_writing/05_code.md), which is
the set of code-fence tags it accepts. `language` is what the book itself is
written in.

## Line budgets

The `chapters` family holds prose to 100 columns, a table row to 240 and a
`text` or `ascii` diagram to 80 — the widths the printed page and the code
panels were sized for. A book whose subject needs a different measure sets its
own:

```json
{
  "lint": { "proseWidth": 88, "tableWidth": 200, "diagramWidth": 100 }
}
```

Only the numbers change; what each check looks at is the same. See
[Linting](../04_publishing/02_lint.md).
