# The book tree

*The files the engine reads, and what each one is for.*

The engine reads a directory and writes two editions of the book in it. It looks
for the same handful of names every time, and every one of them can be moved or
renamed in `book.config.json` when the default does not fit.

## Sources

| Path | What it is |
| --- | --- |
| `book.config.json` | The book's identity: title, tagline, paths and look. |
| `book/SUMMARY.md` | The table of contents and the chapter order. |
| `book/README.md` | The website's front page. |
| `book/chapters/` | The prose, one directory per chapter group. |
| `book/images/` | The pictures the prose uses, and the cover. |

`book.config.json` is read from the directory the engine runs from; everything
else defaults to a path beneath `book/`. The title is the one key a book should
carry — a file with none names the book "Untitled book".

## Outputs

| Path | What it is |
| --- | --- |
| `build/html/` | The website: one page per chapter, plus the index. |
| `build/book.pdf` | The printed edition, cover and all. |

Both are written fresh on each build, and nothing reads back what it wrote. The
two output paths are the `output.web` and `output.pdf` keys.

## Assets

`book/images/` holds the pictures, including the cover. The cover is
`book/images/cover.jpg` by default and may be absent — a book with no picture
gets a typographic cover from its title, tagline and author. It belongs to the
printed edition alone — the website never uses it — and it must be a png or
jpeg, the formats LaTeX can place.

Nothing else in the repository is read as a book. The engine's own `src/` and
`docker/` directories, and the build output under `build/`, are the engine's
furniture, not the book's.

## Paths are configurable

A book that keeps its sources somewhere other than `book/` says so once and the
engine, the linter, the server and both editions follow:

```json
{
  "bookDir": "manuscript",
  "output": { "web": "site", "pdf": "dist/book.pdf" }
}
```

`bookDir` is resolved relative to the book root, so the SUMMARY, the front page,
the chapters and the images all move with it. `summary`, `chapters` and `readme`
move the table of contents, the prose directory and the front page on their own,
all relative to the book root; the images stay under `bookDir`.
