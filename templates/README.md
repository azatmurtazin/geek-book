# Templates for a book repo

Files to copy into a **book** repository that builds with geek-book. A book repo
holds the Markdown and nothing else: the renderers, the linter, the serve command
and the build image all come from the engine, which the book depends on by path.

The files here are the same shape as the ones in a working book repo. There are
three placeholders to replace when you copy a file:

* `<Book Title>` and `<Author>` — in `book.config.json` (and the release title),
* `my-book` — the compose project name in `docker-compose.yml` and the file name
  in `release.yml`,
* `<owner>/<book>` — the repo's own URL in `lychee.toml`.

`ENGINE_REPO` in the workflows already names this engine and needs no edit.

| File | What it is |
| --- | --- |
| `book.config.json` | The only book-specific configuration: title, tagline, sources, outputs, fonts, and the printed edition's `tex` look. |
| `Justfile` | The build recipes; thin wrappers over the engine's binary. |
| `docker-compose.yml` | The `book` service: builds the engine's image and runs the build in it. |
| `.pre-commit-config.yaml` | File hygiene plus "lint and build both editions" on every commit. |
| `lychee.toml` | Link-rot config for the external-link check. |
| `.github/workflows/ci.yml` | Lint, then build both editions in Docker, keeping them as artifacts. |
| `.github/workflows/release.yml` | On a `v*` tag, attach the PDF and a zip of the site to the Release. |
| `.github/workflows/link-check.yml` | External-link check on pushes, PRs, weekly and on demand. |

## Using them

```sh
mkdir my-book && cd my-book
git init
cp -R ../geek-book/templates/. .
# edit book.config.json (title, tagline), and Justfile / lychee.toml if needed
mkdir -p book/chapters
$EDITOR book/SUMMARY.md book/README.md
cp -R ../geek-book/.github ./          # or keep the workflows under templates/
```

The engine must be checked out **next to** the book, because `package.json`
declares it by path:

```json
{ "devDependencies": { "geek-book": "file:../geek-book" } }
```

The `book.config.json` example in this directory is the smallest useful one; the
engine's README documents every key and every default.
