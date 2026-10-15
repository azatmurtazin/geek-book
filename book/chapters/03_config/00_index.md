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
| `bookDir` | `book` | Where the sources live. |
| `output.web` | `build/html` | Where the website is written. |
| `output.pdf` | `build/book.pdf` | Where the PDF is written. |
| `docs` | `README.md`, `CONTRIBUTING.md` | Root Markdown whose links are linted. |
| `languages` | the built-in set | Fence languages the linter accepts. |
| `fonts` | Literata, JetBrains Mono | See [Fonts](01_fonts.md). |
| `tex` | the engine's page | See [The printed page](02_print.md). |

The version is read from the book's own `package.json` unless the config names
one, so the number still lives in exactly one place. `docs` exists because a
book repo holds Markdown outside `book/` — a README, a changelog — whose links
the linter should resolve just the same.
