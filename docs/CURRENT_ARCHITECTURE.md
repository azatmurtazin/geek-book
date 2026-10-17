# Current Architecture

> A snapshot of how `geek-book` is put together today: its modules, its data
> flows, its invariants and its extension points. It describes the code as it
> exists, not an aspiration. Where a design decision is load-bearing it is called
> out, and where the engine deliberately trades something away it is noted too.

---

## 1. What the engine is

`geek-book` is a build engine for books. One set of Markdown sources is compiled
into two editions:

- a **static website** (HonKit/GitBook-style navigation), and
- a **print-ready PDF** (typeset with LuaLaTeX).

The engine ships as **TypeScript source** and is executed through `tsx`; there is
no compile step for the engine itself. A book repository depends on the engine by
path and holds only Markdown plus a `book.config.json`.

Design constraints that shape everything below:

- **No engine build step.** The engine runs from source (`node >= 20`, `tsx`).
  CSS and LaTeX are plain files read at build time, never compiled.
- **One source of truth per fact.** Placeholders, heading anchors, code-fence
  labels, the chapter order and the palette are each computed once and shared by
  both editions so the website and the PDF cannot drift.
- **A book that builds is the contract.** There are no unit tests for the
  builders end-to-end; the engine's own guide under `book/` is the fixture, built
  by CI. Unit tests cover the shared, pure helpers and the two Markdown
  pipelines (see §14).
- **Lenient configuration.** Every config key is optional; a malformed value
  falls back to a default instead of failing the build (§5).

---

## 2. Top-level shape

```text
                 book.config.json + book/**/*.md
                              │
                     load() → BookConfig                ── src/lib/book-config/
                              │
        ┌─────────────────────┼───────────────────────────┐
        │                     │                           │
   build-web-book/       build-tex-book/              lint/
   (HTML site)           (LaTeX → PDF)                (structural checks)
        │                     │
        └──────── both share ─┘
     lib/summary  ·  lib/markdown (marked)  ·  lib/content-placeholders
     lib/smart-typography  ·  lib/code-tokens  ·  lib/fonts  ·  lib/remote-images
     diagrams/  ·  md-to-html/render  ·  _layouts/default.html
```

The CLI (`src/cli.ts`) parses one command, loads the book configuration, and
lazily `import()`s exactly one command module. Nothing is shared through global
state between commands; each command is a small `main(cfg, args)` function.

---

## 3. Repository layout

| Path | Role |
| --- | --- |
| `bin/geek-book.mjs` | The launcher. Registers `tsx` and imports `src/cli.ts`. |
| `src/cli.ts` | Command dispatch, `--config` handling, `geek-book config` dump. |
| `src/lib/book-config.ts` | Public face of configuration; re-exports `book-config/`. |
| `src/lib/book-config/` | `types.ts`, `defaults.ts`, `validators.ts`, `load.ts`. |
| `src/lib/` | Shared, edition-agnostic helpers (see §6). |
| `src/build-web-book/` | The website builder. |
| `src/build-tex-book/` | The LaTeX/PDF builder (IR + serializer + preamble). |
| `src/diagrams/` | Build-time Mermaid → SVG rendering (jsdom shims). |
| `src/lint/` | Structural checks: summary, chapters, links, config. |
| `src/md-to-html/` | Markdown → HTML renderer + the one-file `md` CLI. |
| `src/serve/` | Minimal static preview server. |
| `src/pdf-info/` | `pdfinfo` wrapper (page count) + CLI. |
| `_layouts/default.html` | Standalone HTML shell for previews and `geek-book md`. |
| `book/` | The engine's own user's guide — the end-to-end fixture. |
| `docker/` | The build image (`Docker.book`, `entrypoint.book`). |
| `templates/` | Book-side scaffolding (config, Justfile, CI) copied into a book repo. |
| `book.schema.json` | JSON Schema for `book.config.json`; also read by the linter. |
| `Justfile`, `docker-compose.yml`, `.pre-commit-config.yaml`, `lychee.toml` | Local/Docker/CI tooling (§13). |

---

## 4. CLI and command dispatch

`src/cli.ts` is the whole front door.

1. **`--config` extraction.** `takeConfigOption(argv)` (`lib/book-config/load.ts`)
   removes `--config <file>` / `--config=<file>` from anywhere on the command
   line and returns the rest. A following flag is not treated as a filename, and
   a bare `--config` is reported as a missing value.
2. **Config load.** `load(cwd, namedFile)` reads `book.config.json` into a
   `BookConfig`. With `--config`, the config's directory becomes the book root,
   so relative paths inside it resolve beside it — one checkout can build another
   book without changing directory.
3. **Dispatch.** Each command in the `COMMANDS` table dynamically imports its
   module and calls `main(cfg, args)`. Commands are:

   | Command | Module | Output |
   | --- | --- | --- |
   | `web [dir]` | `build-web-book/cli.ts` | Static site (default `build/html`). |
   | `pdf [file]` | `build-tex-book/cli.ts` | PDF (default `build/book.pdf`). |
   | `serve [dir] [port]` | `serve/cli.ts` | Static preview over HTTP. |
   | `lint [family…]` | `lint/cli.ts` | Structural checks (exit code). |
   | `md <in> [out]` | `md-to-html/cli.ts` | One Markdown file → standalone HTML. |
   | `pdf-info <pdf>` | `pdf-info/cli.ts` | `pdfinfo` output (page count etc.). |
   | `config` | (inline) | The resolved config, as JSON, with root-relative paths. |

The `geek-book config` command is important for debugging: it prints the fully
resolved `BookConfig` (defaults applied, paths absolute-then-relativised), so a
user can see exactly what the engine inferred.

Exit codes follow a small convention: `0` success, `1` a build/content failure,
`2` a usage error.

---

## 5. Configuration: `BookConfig`

Lives in `src/lib/book-config/` behind a single public re-export
(`src/lib/book-config.ts`) so every importer still writes `book-config.js`. It is
split into four modules:

- **`types.ts`** — the shapes (`BookConfig`, `TexConfig`, `WebConfig`, …) plus
  the `PAPERS` table (a4/a5/letter/legal with millimetre dimensions) and the
  diagram-theme list.
- **`defaults.ts`** — the single fallback table (`DEFAULTS`). Every value a book
  that says nothing gets. Uses `satisfies` to be checked against the shapes
  without widening literal types.
- **`validators.ts`** — one lenient `as*` reader per value plus composite
  `read*` functions. Each returns the fallback rather than throwing, so a
  malformed config degrades to the conventional book.
- **`load.ts`** — `CONFIG_FILE`, `takeConfigOption`, and `load`.

Key behaviours in `load()`:

- **Defaults come from convention.** `bookDir` defaults to `book/`; `summary`
  to `<bookDir>/SUMMARY.md`; `chapters` to `<bookDir>/chapters`; `readme` to
  `<bookDir>/README.md`; `cover` to `<bookDir>/cover.jpg`. Each may be overridden
  anywhere on disk; SUMMARY entries still resolve against `bookDir`.
- **`version` and `title` fall back to the book's own `package.json`**, so the
  number lives in one place.
- **Derived geometry.** `textWidthMm`/`textHeightMm` are computed from the paper
  minus margins (clamped to a positive minimum), and become the text block the
  PDF builder measures pictures against.
- **Coupled font defaults.** The default *bold* face and *webfont stylesheet*
  belong to the default family (Literata). A book that names its own families
  gets its own bold and no webfont unless it asks for one — so `fonts.bold`,
  `fonts.web` are conditionally defaulted in `load.ts`, not `defaults.ts`.
- **Languages.** The linter's accepted fence languages start from
  `DEFAULT_LANGS`, and every key of the book's own `code` map is added.
- **Web description** defaults to the tagline when unspecified.

Overrides available from `book.config.json` include: title/tagline/author/version,
`placeholders` and `strings` (interface translation), `language`, the source
paths, `output`, `docs`, `languages`, the `code` language map, `images` (remote
fetching), `lint` budgets, `markdown.smartTypography`, `diagrams`, `fonts`, `web`
(css/head/baseUrl/description/favicon/links), `tex` (geometry/colors/type/class/
side/tocDepth/titlePage/copyright/isbn/preamble) and `serve.port`.

`book.schema.json` mirrors this for editors (via the config's `$schema`) and is
also consumed by the linter's `config` family (§12), so the schema and the
lenient readers are kept as two views of the same contract.

---

## 6. The shared layer (`src/lib/`)

These modules are the vocabulary both editions share. They are deliberately
edition-agnostic and mostly pure.

| Module | Responsibility |
| --- | --- |
| `summary.ts` | Parse `SUMMARY.md` into an ordered `TocItem[]` (groups + entries, with indent and source line). The single source of chapter order for the site, the PDF and the linter. |
| `markdown.ts` | `markedInstance(cfg)` — a configured `marked` with GFM on, slug-based heading ids, code blocks run through the comment tokenizer and language-label wrapper. Also `slugify`, `plainText`, `splitLines`. |
| `content-placeholders.ts` | Fill `{{ token }}` build-time tokens in chapter prose. Built-ins (`version`, `title`, `author`, `tagline`) win over a book's own map; fenced code is left byte-for-byte. |
| `smart-typography.ts` | Optional curly quotes and `--`/`---` dashes. Exposed both as a token walk (`applySmartTypography`, used by the web `marked` hook and the print walk) and a string form (`smartTypography`, used by the linter on raw headings so its slugs match). |
| `code-tokens.ts` | Split a code fence into `code`/`comment` runs, keeping strings inside code so `//` and `#` in a string are not comments. Both renderers colour the same runs. |
| `code-meta.ts` + `langs.ts` | The book's `code` map first, then a built-in table: comment style (`slash`/`hash`) and display label per fence language. |
| `images.ts` | `resolveImagePath(src, fromRelBook)` — book-root-absolute, file-relative, or remote → book-relative path or `null`. `isRemoteImage`. |
| `image-size.ts` | Pixel dimensions read from PNG/JPEG headers, for the PDF's picture sizing. |
| `remote-images.ts` | `RemoteImages` — fetches `http(s)` images once per build into the output (`<sha1(url)><ext>`), with a configurable timeout and content-type map; refuses formats the print edition cannot embed when `print: true`. |
| `fonts.ts` | The CSS stacks (`textStack`, `codeStack`, `diagramFamily`), the webfont `<link>`s, and the `:root` font variables. |
| `web-palette.ts` | `webPaletteVars` — the website's `:root` palette derived from `tex.colors`, so the two editions cannot drift. |
| `site-meta.ts` | `basePath`, `pageUrl`, `metaTags` — canonical URL and social/metadata tags shared by the site and the standalone layout. |
| `html.ts` | `escapeHtml`, `brandHtml` (first word emphasized). |
| `css.ts` | `readCss(importer, name)` — read an engine-shipped stylesheet relative to the module that asks. |
| `ui-strings.ts` | The fixed interface labels (Previous, Next, Contents, Home, toggle names), overridable via config `strings`. |

A note on `markdown.ts` ↔ `md-to-html/render.ts`: `markdown.ts` imports
`highlightComments` from the renderer. This is a small back-edge in an otherwise
layered design; the shared `marked` instance needs the comment highlighter, and
the renderer is where it lives.

---

## 7. The Markdown → HTML renderer (`src/md-to-html/`)

This is the *only* HTML content pipeline. The site build calls it; the `md` CLI
calls it; the standalone preview wraps its output.

`render.ts` exports, in increasing completeness:

- **`renderBody(cfg, source)`** — placeholders substituted, then `marked`.
  Headings get slug ids; code blocks get the label wrapper and comment spans.
- **`renderSourceToHtml(cfg, source)`** — `renderBody` plus Mermaid. Mermaid
  fences are pre-extracted (`preprocessMermaidMd`) into placeholder paragraphs,
  the Markdown is parsed, then each placeholder is replaced with the rendered
  inline `<svg>` (`substituteDiagrams`). Because the SVG is injected *after*
  `marked`, the SVG never passes through the Markdown parser.
- **`renderStandaloneHtml(cfg, source)`** — `renderBody` wrapped in
  `_layouts/default.html`, titled from the first `#` heading.
- **`renderStandaloneHtmlFromSource`** — the same with Mermaid.

`wrapInLayout` fills the layout's placeholders with replacement *functions*
(not strings), because CSS and body HTML can contain `$` sequences. The layout
(`_layouts/default.html`) is the standalone shell: header, reading column
(`class="page book-body"`), footer. It inlines `lib/content.css` — the content
rules shared with the web book — so code blocks and diagrams look the same in
both.

---

## 8. The website builder (`src/build-web-book/`)

Entry: `cli.ts` → `main(cfg, args)`. The site is a directory of `.html` pages:

1. **Validate inputs** — check the book's own `web.css`/`web.head`/`web.favicon`
   exist, and that `SUMMARY.md` exists.
2. **Plan the pages.** `parseSummary` → for each entry with a written `.md` file,
   map `relBook → outputRel` (`.md` → `.html`). Sidebar groups with no written
   chapter are dropped.
3. **Build the reading order** — a linear `readers` array with `prev`/`next`.
4. **Clean output** unless `output.clean: false`.
5. **Emit shared assets** — `assets/style.css` (assembled by `site.ts`:
   font vars + palette vars + `content.css` + `site.css` + the book's own css)
   and the favicon copy.
6. **Fetch remote images** into `images/remote/`.
7. **Render the front page** (`cfg.readme`) as `index.html`; if absent, write a
   meta-refresh redirect to the first chapter.
8. **Render each chapter** — `renderSourceToHtml`, then link rewriting, then
   image rewriting/copying, then page assembly. Each page is written under its
   `outputRel`.

The site is split across four modules:

- **`page.ts`** — `assemblePage` (the whole page), `pageDocument` (the HTML
  template), the single inline `SITE_SCRIPT` (theme + folding nav, run
  pre-paint from `<head>`, storage-guarded, works without JS), `headHtml` and
  `stylesheet`.
- **`nav.ts`** — `sidebarHtml` (the SUMMARY tree as foldable `<details>` parts,
  the current part opened) and `footerHtml` (book name/version + `web.links`,
  with `{path}`/`{url}` substitution).
- **`links.ts`** — `rewriteLinks` (`.md`/`.md#anchor` → relative `.html`) and
  `rewriteImages` (each `<img src>` → output-relative path; collects the
  book-relative source paths to copy, and points remote sources at the fetched
  copies).
- **`site.ts`** — re-export facade (`assemblePage`, `headHtml`, `stylesheet`,
  `rewriteLinks`, `rewriteImages`, nav types).

Styling: `site.css` is the layout (sidebar, header, reading column, prev/next,
day/night palette); `lib/content.css` is the markup shared with the standalone
layout. The reader's day/night and folded-nav choices live in `localStorage` and
are applied to `<html data-theme/data-nav>` before first paint.

---

## 9. The print builder (`src/build-tex-book/`)

This is the most structured pipeline: **Markdown → document tree (IR) → LaTeX →
PDF**. The IR is the contract between parsing and serialization and contains no
LaTeX.

### 9.1 The IR (`ir.ts`)

- `Chapter` = `{ blocks, figures, images }`.
- `Block` = heading | list | table | image | paragraph | code panel | callout |
  figure | rule.
- `HeadingBlock` carries `anchors` — `c<id>` and `c<id>--<slug>` on a chapter
  title, the slug alone below. **This is the parity mechanism**: the anchors are
  exactly the web build's heading ids, so an intra-book link names the same
  heading in both editions.
- `Inline` = text | code | strong | em | del | break | link | image.
- `ChapterContext` threads `chapterId`, `relBook`, `idOf` (path → id) and the
  shared `RemoteImages` instance.

### 9.2 Parsing (`parse.ts`, `blocks.ts`, `inlines.ts`, + helpers)

- `tokensToIr` is the **pure walk**: Markdown → IR, no I/O. `parseChapter` is the
  full path: it substitutes placeholders, fetches remote images, renders Mermaid
  fences to figures (before lexing, so SVG never enters `marked`), then walks.
- `blocks.ts` maps `marked` block tokens; `inlines.ts` maps inline tokens;
  `images.ts` resolves and registers picture copies; `links.ts` resolves link
  targets to IR anchors or external URLs; `entities.ts` decodes HTML entities;
  `state.ts` is the walk's scratch space (picture copies, figures, lookup by
  placeholder index).
- Smart typography is applied by the walk itself (the web's `marked` hook only
  runs on `parse`), keeping the two editions' punctuation identical.

### 9.3 Serialization (`tex.ts`, `escape.ts`, `figures.ts`)

`tex.ts` is **the only module that spells LaTeX**. It never sees Markdown — a
rendering change belongs here; a meaning change belongs in `parse.ts`.

- Headings → `\chapter`/`\section`/… with `\label{anchor}` per anchor; a chapter
  title also emits `\markboth` for the running head; indented SUMMARY entries get
  TOC indentation.
- Code panels → a tinted `\begin{codebox}` around fancyvrb `Verbatim`, comments
  coloured from the same `tokenizeCode` runs.
- Tables → `tabularx` with colortbl rules matching the site.
- Links → external `\href`, intra-book `\hyperref[label]`. (`\hyperref`, not
  `\hyperlink`, because there is no `\hypertarget` and LuaTeX would silently
  send every unresolved link to the last page.)
- `escape.ts` — `texEscape` (prose) and `texEscapeCode` (fancyvrb commandchars).
- `figures.ts` — measure pictures against the configured text block, print at the
  web edition's size (96 px/inch) and shrink-to-fit only when needed (never blow
  up a small image).

### 9.4 Document assembly (`cli.ts`, `preamble.ts`, `front-matter.ts`)

- `cli.ts` numbers chapters (`c<id>`) from SUMMARY the same way the web build
  does, builds each chapter's LaTeX, writes figures (SVG → PDF via
  `rsvg-convert`) and copies images into `build/figures/`, then writes
  `book.tex` and compiles it.
- **Three LuaLaTeX passes**: two `-draftmode` passes to converge the TOC page
  numbers, then a final pass to draw the converged TOC.
- **Unresolved-reference check**: the last pass's log is scanned for
  "Hyper reference … undefined" and the build fails, naming the chapter — the one
  check that compares the linter's anchors against the labels actually emitted.
- `preamble.ts` loads `preamble.tex` and fills `<< … >>` placeholders from the
  book config (geometry, fonts, palette, type scale, babel, contents name,
  title), then appends the book's own `tex.preamble` file.
- `front-matter.ts` emits the optional cover page, title page, imprint page
  (copyright/ISBN + typeface colophon) and the table of contents.
- A final `pdfPages` call reports the page count via `pdfinfo`.

`preamble.tex` is plain LaTeX — not a TypeScript template literal — so backticks,
`$` and `\setmainfont` need no escaping, and an editor highlights it correctly.

---

## 10. Diagrams (`src/diagrams/`)

Mermaid is a browser component. The engine shims a minimal DOM and renders
diagrams **at build time** into self-contained inline SVG, used identically by
the site and the PDF (as an `rsvg-convert`ed figure).

- **`shims.ts`** — `installBrowserShims`: a jsdom window with the globals Mermaid
  (and dompurify/d3) expect, plus stubs for the SVG measurement APIs jsdom does
  not implement (`getBBox`, `getComputedTextLength`, `getBoundingClientRect`),
  which size boxes from their label text since jsdom performs no layout. The DOM
  must exist *before* importing Mermaid, so the import is dynamic.
- **`theme.ts`** — `diagramOptions` and `themeVariables`: the palette derived from
  `tex.colors` under the default `auto` theme, or a named Mermaid theme used as-is,
  with the diagram font family and type size.
- **`fixup.ts`** — `fixViewBox` (recompute the viewBox from emitted geometry,
  since jsdom cannot measure) and `foreignObjectToText` (rewrite Mermaid's
  `<foreignObject>` XHTML labels into native SVG `<text>`, because
  `rsvg-convert` will not reliably draw `<foreignObject>`).
- **`render.ts`** — the loader and the entry points: `renderMermaid`,
  `preprocessMermaidMd` (extract fences → indexed placeholders), `substituteDiagrams`.

The rendered SVG is self-contained (geometry + native text), so the site embeds
it with no client-side JS and the print build embeds the identical drawing.

---

## 11. Static preview and PDF info

- **`serve/cli.ts`** — a minimal `http` server over the built site (default port
  from `serve.port`, default `build/html`). Serves with a MIME table, redirects
  directories to `index.html`, and refuses paths that escape the root.
- **`pdf-info/cli.ts`** — `pdfinfo` passthrough for a finished PDF.
- **`pdf-info/pdf.ts`** — `pdfPages(file)`, the page-count reader the print
  builder calls at the end of its run.

---

## 12. The linter (`src/lint/`)

A TypeScript port of an original `scripts/lint.py`; behaviour and messages are
preserved. It is **offline** and structural.

`cli.ts` runs four families — `summary`, `chapters`, `links`, `config` — any
subset of which can be selected. Findings are graded:

- **errors** — fail the build (exit 1),
- **warnings** — advisory, do not fail,
- **notes** — expected while a book is being written, summarised rather than
  listed (unless `-v`).

Families:

- **`summary.ts`** — every `.md` under `chapters/` is listed in SUMMARY; every
  planned entry exists (a missing one is a *note* — the tree may run ahead of the
  prose); indented sections must follow a chapter; every group directory has a
  `00_index.md`.
- **`chapter.ts`** — exactly one H1 (first line), no skipped heading levels, no
  tabs, no trailing whitespace, newline-terminated file, balanced and
  language-tagged fences, `text`/`ascii` diagram width budget, prose/table column
  budgets (a line whose longest unbreakable run exceeds the budget is exempt,
  since no wrapping could help).
- **`links.ts`** — internal links and `#anchors` resolve. Anchors are computed
  with the same slugifier (and optional smart-typography pass) the renderers use,
  so a passing lint means the built links land. Also checks local image targets;
  remote images become notes.
- **`config.ts`** — validate `book.config.json` against `book.schema.json` (a
  small hand-rolled subset of JSON Schema). Advisory only: every finding is a
  warning, matching the engine's lenient treatment.

`paths.ts` (`markdownFilesUnder`, `hasMarkdown`) and `markdown.ts` (fence,
heading, link, image and code-span regexes, `parseFenceLang`, `expandTabs`) are
the shared check helpers.

---

## 13. Build, tooling and delivery

- **`bin/geek-book.mjs`** — registers `tsx` via `tsImport` and imports
  `src/cli.ts`. `package.json` exposes it as the `geek-book` binary and adds
  convenience `npm run` scripts (`web`, `pdf`, `serve`, `lint`, `typecheck`,
  `test`, per-family lint).
- **`Justfile`** — the engine's own guide recipes: `html`, `pdf`, `serve`,
  `lint`, `test`, `clean`, `install-tools`, `docker-book`. `html`/`pdf` skip the
  build when sources are older than the output.
- **`docker/Docker.book`** — an Alpine image (Node 26) carrying the full
  toolchain: LuaLaTeX (`texlive-luatex`, `texlive-latexextra`,
  `texlive-plaingeneric` for `ulem`), `poppler-utils`, `rsvg-convert`, the fonts
  (JetBrains Mono from Alpine, Literata from Google Fonts, fontconfig-registered),
  and `just`. The engine (with runtime deps baked in) is installed and linked onto
  `PATH`, so a book mounts only its own sources.
- **`docker-compose.yml`** — the `book` service: bind-mounts the repo into
  `/workspace`, keeps `node_modules` in a named volume (Linux binaries), and runs
  the build as the host uid after a root-side chown (`entrypoint.book`).
- **`templates/`** — the book-side scaffolding copied into a new book repo: a
  `book.config.json`, a `Justfile`, a compose service, a pre-commit config,
  `lychee.toml`, and three workflows.
- **CI (`.github/workflows/`)**:
  - `ci.yml` — lint the engine + guide on Node, then build both editions in the
    engine's Docker image (cached layers) and upload `build/html` and
    `build/book.pdf` as artifacts.
  - `release.yml` — on a `v*` tag, verify the tag matches `package.json`, build
    both editions, `npm pack` the engine and zip the site, then publish all three
    as release assets.
  - `link-check.yml` — `lychee` external-link check (pushes, PRs, weekly, manual).
- **`.pre-commit-config.yaml`** — file hygiene plus `just lint`, `just test`, and
  "build both editions" on every commit.
- **`lychee.toml`** — remote links only; local paths/anchors are the linter's job.

---

## 14. Testing

`vitest` (`npm test` / `just test`). The suite targets the **pure, shared layer
and the two Markdown pipelines**, not the full builders:

- `test/lib/` — `book-config` (diagrams block, lenient fallbacks),
  `markdown` (slugify/plainText), `smart-typography`.
- `test/md-to-html/` — the standalone renderer.
- `test/build-tex-book/` — `parse`, `tex`, `preamble`.
- `test/diagrams/` — `theme`.
- `test/parity/pipelines.test.ts` — **cross-pipeline parity**: the HTML and TeX
  renderers from the same Markdown must agree on heading anchors (by slug),
  placeholder substitution, and fence labels. Golden files
  (`test/fixtures/golden/chapter.{md,html,tex}`) are compared, not rewritten;
  `GOLDEN_UPDATE=1` regenerates them on an intentional change.
- `test/fixtures/` — a `minimal` fixture book, images of various aspect ratios,
  and the golden chapter. Helpers `fixtureConfig()` and `chapterContext()` load a
  fixture config and build a `ChapterContext` so tests never touch the engine's
  own `book.config.json` or change directory.

End to end, **the guide itself is the test**: `just lint`, `just html`, `just pdf`
(and the same three in Docker in CI) exercise the real pipelines on a real book.

---

## 15. Cross-cutting invariants

These hold across both editions and are the things to preserve when changing the
engine:

1. **Anchors/ids are one algorithm.** Web heading ids and print labels are both
   `slugify(plainText(tokens))`, with optional smart typography applied first.
   The linter computes the same ids, so a passing lint implies working links.
2. **Placeholder substitution happens once, identically**, before either parser;
   fenced code is never substituted.
3. **Code comments are found by one tokenizer** (`tokenizeCode`) for both targets;
   strings are not comments.
4. **The palette is one source.** `tex.colors` colours the PDF and, via
   `web-palette.ts`, the website. Site-only colours live in `site.css`.
5. **Fonts are named, not shipped by the engine**; both editions ask for a family
   by name (webfont link for the web, fontconfig for print), so a book with
   custom fonts must install them where it builds.
6. **Remote images are fetched before rendering** and referenced locally, so
   neither edition hotlinks at read time.
7. **The website and the PDF embed the same diagram** (build-time SVG).
8. **Config never throws**; a bad value degrades to a default.
9. **Chapters are numbered from SUMMARY once per build**, giving `c<id>` in both
   editions.

## 16. Known tensions and extension points

- **The `markdown.ts` ↔ `md-to-html/render.ts` back-edge** noted in §6 is the one
  cross-layer import in the shared layer.
- **`build-tex-book` is the deepest pipeline.** To add a Markdown construct,
  touch the IR (`ir.ts`), the walk (`blocks.ts`/`inlines.ts`) and the serializer
  (`tex.ts`) — and, for parity, the web path (usually free, via `marked`, plus
  `content.css`/`site.css`).
- **Adding a config key** means: a type and default, a lenient reader, wiring in
  `load.ts`, a schema entry in `book.schema.json`, and (for the config dump) a
  line in `cli.ts`'s `printConfig`. The `config` lint family then covers it.
- **Adding a command** means: a `COMMANDS` entry in `src/cli.ts` and a
  `main(cfg, args)` module.
- **The website has no client-side framework**; the only script is the inline
  theme/nav bootstrap in `page.ts`.
- **There is no incremental build** inside the engine; the `Justfile` approximates
  one by timestamp comparison for the engine's own book.

---

## Appendix: source map (by line count, approximate)

| Area | Modules |
| --- | --- |
| Entry / config | `cli.ts`, `lib/book-config*` (4 modules) |
| Shared | 17 modules under `src/lib/` |
| Web | `build-web-book/{cli,page,nav,links,site}.ts`, `site.css` |
| Print | `build-tex-book/` (14 modules + `preamble.tex`) |
| Diagrams | `diagrams/{render,shims,theme,fixup}.ts`, `jsdom-shim.d.ts` |
| Lint | `lint/{cli,chapter,config,links,markdown,paths,summary,errors}.ts` |
| HTML render | `md-to-html/{cli,render}.ts`, `_layouts/default.html` |
| Tools | `serve/cli.ts`, `pdf-info/{cli,pdf}.ts` |
