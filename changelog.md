# Changelog

Notable changes to **geek-book**, most recent first. Versions follow the git
tags (`v0.1.0`, `v0.1.1`, `v0.1.2`, `v0.1.3`, `v0.1.4`, `v0.1.5`, `v0.1.6`,
`v0.1.7`, `v0.1.8`, `v0.1.9`); each released version follows, most recent first.
Short commit hashes are given in parentheses for traceability.

| Version             | Date       |
| ------------------- | ---------- |
| 0.1.9               | 2026-10-22 |
| 0.1.8               | 2026-10-22 |
| 0.1.7               | 2026-10-21 |
| 0.1.6               | 2026-10-21 |
| 0.1.5               | 2026-10-21 |
| 0.1.4               | 2026-10-20 |
| 0.1.3               | 2026-10-17 |
| 0.1.2               | 2026-10-15 |
| 0.1.1               | 2026-10-15 |
| 0.1.0               | 2026-10-14 |

## [0.1.9] — 2026-10-22

The PDF's info dictionary now carries the book's identity: Title, Author and
Subject are filled from `title`, `author` and `web.description` (the tagline by
default), so a reader's document properties show the book rather than blank
fields. The page count and layout are unchanged.

### Added

- The built-in preamble writes `\hypersetup` metadata from the resolved book
  settings. An empty author or description omits that field instead of writing
  an empty one (`8eac8a2`).
- The PDF baseline's `book.info` now pins Title, Subject and Author alongside
  the page count and page size, so missing metadata fails `just verify`
  (`8eac8a2`).

### Documentation

- The print and commands chapters describe the metadata mapping and the fields
  `geek-book pdf-info` reports (`8eac8a2`).

## [0.1.8] — 2026-10-22

A book without a cover image no longer opens straight onto the contents: the
printed edition sets its typographic page — title, tagline and author — as the
cover. A book with a cover image is unchanged, and `tex.titlePage` still adds a
title page after that picture.

### Added

- The printed edition falls back to a typographic cover when `cover` names no
  file. The fallback reuses the title page, so a book without artwork gets the
  same type as a book that asked for `tex.titlePage`; the option does not add a
  second copy of the page when there is no picture cover (`b80daf5`).

### Documentation

- The writing and print chapters, the schema and the settings comments describe
  the fallback and the narrowed meaning of `tex.titlePage` (`b80daf5`).

## [0.1.7] — 2026-10-21

The safety net now covers the release itself: a tag cannot publish before lint
and the unit suite pass in the same job. The refactor had left one port with no
consumer, and a new test rejects any source module the CLI cannot reach. No
book builds differently, except that the guide's configuration chapter now
documents the `images`, `diagrams` and `serve` keys.

### Changed

- The release workflow runs `just lint` and `just test` in the book image before
  `just verify`, so publishing no longer races the separate CI run (`cd81bc4`).
- Removed the unused `ImageMeasurer` port and `HeaderImageMeasurer` adapter; the
  printed edition reads `imagePixels` directly. A reachability test walks
  relative imports from `src/cli/main.ts` and fails on any source module nothing
  reaches (`cd81bc4`).
- The `image-size` adapter is covered from 19% to 94% (png fixtures, a jpeg that
  walks junk, fill and standalone markers, truncation and a bad segment length),
  and the standalone renderer's `md/render` failure path is tested. The floors
  rise to 82/72/90/82 (`cd81bc4`).

### Documentation

- The configuration chapter lists `images.timeout`, `images.maxBytes`,
  `images.types`, `diagrams.theme`, `diagrams.fontSize` and `serve.port`
  (`cd81bc4`).

## [0.1.6] — 2026-10-21

This release hardens the two places where the engine reads something it does
not control: the request path a preview server receives and the response a
remote image host sends. Both now fail closed, and both have tests that drive a
real socket. A valid book builds as before; the baseline moves for the new
config key, the paragraph documenting it, and the version string.

### Added

- `images.maxBytes` bounds one remote-image response, in bytes (20 MiB by
  default). `images.timeout` already bounded time; together they keep a wrong
  URL or an endless stream from holding the build open or exhausting its
  memory. The fetch stops with the URL when an answer is too large
  (`1beb047`).
- `just release X.Y.Z` checks a clean `main`, bumps `package.json` and the
  lock, refreshes and verifies the baseline in the pinned book image, then
  commits, tags and pushes. The changelog section stays the one human step, and
  the recipe refuses to run without it (`cfbc2ec`).

### Fixed

- `geek-book serve` refuses a request that climbs out of the site root with an
  encoded `..`. The old check compared path prefixes, so a sibling directory
  whose name began with the root's was reachable (`1beb047`).
- A malformed request path such as `/%zz` answers 400 instead of throwing out
  of the request listener and taking the preview down; a directory without an
  `index.html` answers 404 instead of failing mid-stream (`1beb047`).

### Documentation

- The architecture notes now live in the guide: "Inside the engine" describes
  the four layers, the dependency rule, the ports, the safety net and where new
  code goes (`fdafe78`). The four files under `docs/` — the current and target
  architecture, the refactoring plan and its checklist — are removed;
  `CONTRIBUTING.md` keeps the contributor-facing summary.

## [0.1.5] — 2026-10-21

This release hardens the safety net rather than the engine. The unit suite now
runs in CI on every supported Node release, a release can no longer publish a
tree whose baseline does not verify, and the linter's rules, the printed front
matter and the CLI surface have direct tests. Nothing observable changes: the
only baseline diff is the version string.

### Under the hood

- CI runs the unit suite for the first time — on Node 20, 22 and 26, so the
  `engines` promise is exercised — and the book job waits for it (`81391ab`).
- The release workflow runs `just verify` before publishing, so a stale
  baseline can no longer ship, and it accepts `workflow_dispatch` so an
  existing tag can be re-published without moving it (`74e5936`).
- The unit suite fails early when `test/baseline/config.json` lags
  `package.json`, naming the `just docker-baseline` fix (`9debb30`).
- `just coverage` and `npm run test:coverage` produce a report again (the
  provider was trying to read the stylesheets as JavaScript) and enforce
  floors (`c4a253d`).
- Direct tests for the linter's rules and file handling, the printed front
  matter, and the CLI's exit codes and stream split; line coverage under
  `src/` rises from 69% to 81% (`02cd72b`, `3f0105f`).
- The unused branded path types (`BookPath`, `OutputPath`, `SourcePath`) are
  removed; `Anchor` stays (`2ed6a70`).

## [0.1.4] — 2026-10-20

This release rebuilds the engine around a clean architecture without changing
what it produces: with the new keys left off, the website, PDF, lint findings
and rendered Markdown are byte-identical to 0.1.3. Two opt-in settings join the
configuration — `markdown.breaks` and `web.prettyUrls` — and the website is now
rendered from the same document model as the printed edition.

### Added

- `markdown.breaks`: a single newline in a paragraph becomes a line break
  (`<br>`) on the website. Off by default, because the linter's `lint.proseWidth`
  encourages hard-wrapping. The printed edition always keeps a single newline
  soft, so the PDF is unaffected.
- `web.prettyUrls`: write each page as a directory with its own `index.html`
  (`chapters/01_tree/`) instead of a `.html` file, so URLs carry no extension.
  Off by default; with it off the built site is unchanged. Every internal link
  follows the new shape, and the preview server redirects a directory request
  that lacks its trailing slash.

### Under the hood

- Rebuilt the engine around a clean-architecture layout with no observable
  change: `domain/` (model and pure values), `application/` (ports, use cases,
  pipelines), `adapters/` (Markdown, Mermaid, HTTP, filesystem, reporting,
  rendering) and `cli/` as the composition root (`9d88dd1`, `7bce348`,
  `fdfa992`).
- One source pipeline now feeds both editions: a `MarkdownParser` port replaces
  the separate `marked` walks, and the website is rendered from the same model
  as the printed edition (`5ec91db`, `5bd4a89`, `63e8eb7`).
- Build, lint, serve, standalone and `pdf-info` became use cases driven from
  `cli/main.ts`, with Node behind environment ports and reporting behind its own
  ports (`e0529bf`, `1ea5990`, `008d145`).
- Added baseline tooling: `just baseline` records the website hash, lint
  messages, config and rendered Markdown, and the pinned Docker image records
  the book's text and page count; `just verify` compares all six
  (`9d88dd1`, `f1c2f86`).
- `dependency-cruiser` now enforces the layer boundaries as part of `just lint`
  (`just boundaries`: `54b8fa6`); the old `src/lib/` shims and the legacy
  `parse` stage are gone (`0355afd`).

### Documentation

- `CONTRIBUTING.md` and the README describe the new layout, the dependency rule
  and where new code belongs; `CURRENT_ARCHITECTURE.md` is marked historical and
  the refactoring plan records each phase's outcome (`bb363a2`).

## [0.1.3] — 2026-10-17

This release is mostly configuration: almost everything a book might want to
change — its language and labels, the website's chrome, the printed edition's
class and front matter, the code-fence labels, and the palettes — can now be
set in `book.config.json`, and `book.schema.json` plus a `config` lint family
check it. Alongside the features, the engine grew a Vitest suite, a cross-
pipeline parity test with golden fixtures, and a round of module splits.

### Added

- A `book.schema.json` and a `config` lint family, so a book's configuration is
  validated with useful messages (`a9ea62d`).
- The book's language and its interface labels are configurable, so the guide's
  wording can be localised (`538fc92`).
- Title, author and tagline tokens with a placeholders map: prose, the preamble
  and the layout can interpolate the book's metadata, and a book can name its
  own tokens (`f0b68bc`).
- `markdown.smartTypography` for curly quotes and dashes (`7ea0547`).
- A code-fence language's label and comment style are declared in the config
  (`60cc6c9`).
- Linter line budgets are configurable (`e416b03`).
- Printed-edition controls: `tex.class`, `tex.side` and `tex.tocDepth`
  (`5fb70e9`, `833746a`), and front-matter controls that print a title page
  and/or an imprint page plus colophon before the contents (`1f61b39`).
- Mermaid diagram theme and font size are configurable (`7950d12`).
- Website shape and chrome are configurable: the website metadata keys
  (`c210c08`), the `readme` key for the home page (`97ef47a`), the `chapters`
  key for the prose directory (`43924a1`), and `web.css`/`web.head` to add
  styles and `<head>` markup (`26c61ed`).
- The `summary` key names the table-of-contents source file (`0707b76`).
- Build and serve behaviour is configurable: output cleaning
  (`output.clean`), remote-image limits (`images.timeout`, `images.types`) and
  the serve port (`serve.port`) (`0a76769`).

### Changed

- The website palette and the Mermaid palette are derived from `tex.colors`, so
  both editions share one palette (`5e4ff9d`, `a1e53d1`).
- The global `CONFIG` singleton became a value threaded through function
  arguments (`a76f217`), and `load()` takes its root and config file explicitly
  (`250e173`).

### Fixed

- A hard line break (`<br>` or a trailing double space) is terminated and can no
  longer swallow the next word (`23ce21a`, `b47108f`); the HTML renderer adds
  breaks while the TeX and remote-image parsers stay GFM-only (`e4eb407`).
- The page title is escaped in the layout's `<title>` (`f42f0f7`).

### Documentation

- Added `docs/CURRENT_ARCHITECTURE.md`, `docs/CLEAN_CODE_ARCHITECTURE.md` and
  `docs/ARCHITECTURE_REFACTORING_PLAN.md` describing the engine as it is, the
  proposed clean architecture, and how to migrate (`d7cd2ae`).
- Documented the image and cover formats each edition reads (`7d5a4d6`),
  updated the README and `SUMMARY` (`6827bd1`), and reorganised `TODO.md` with a
  plan for refactoring, tests and splitting large files, settling on Vitest
  (`e7dd1b0`, `c33235a`, `773b1ed`, `4894107`, `b57cf46`, `f9a7285`).

### Under the hood

- Adopted **Vitest** and added suites for the shared helpers (`13bcb87`), for
  `md → html` behind a fixture book (`95e29d2`), for `md → tex` and the preamble
  (`164e723`), and a cross-pipeline parity suite with golden fixtures
  (`6d13a33`). Goldens are compared, not rewritten (`375ed99`).
- Split several large modules: `parse.ts` gained a pure `tokensToIr` walk
  (`97b4095`, `6b88293`), and `book-config.ts` (`9d42fab`),
  `diagrams/render.ts` (`d5b92b9`), `build-web-book/site.ts` (`c1f88ff`) and
  `build-tex-book/tex.ts` (`f025696`) were broken into focused files.

## [0.1.2] — 2026-10-15

### Added

- `--config <file>` to point any command at another configuration file
  (`bc59008`).

### Documentation

- Kept the README brief and pointed it at the guide (`2fc8f21`).

## [0.1.1] — 2026-10-15

### Added

- A release workflow that builds both editions of the guide with the engine's
  Docker image and publishes them — the PDF, the website zip and the engine
  package — as assets on a version tag (`0b35a0e`).

### Changed

- Replaced the lorem ipsum sample with the user's guide, so the project
  documents itself with the engine it describes (`0432e64`).
- Bumped the version to 0.1.1 (`8b8104a`).

## [0.1.0] — 2026-10-14

The first release: a Markdown-in, website-and-PDF-out build engine.

### Added

- Initialised the repository (`9870002`), then added the engine, its Docker
  build image (Node + LuaLaTeX + fonts), the CI and lint scaffolding, and a
  lorem ipsum sample book (`5b048a1`).
- Book-side templates under `templates/` — config, Justfile, compose service,
  pre-commit and CI workflows — and the engine installed into the image
  (`c2dbefc`).
- Images are rendered and copied in both editions (`d487f8d`), small pictures
  print at their own size (`81c749c`), and remote images are fetched at build
  time (`afce6c9`).
- A day/night theme switch and a foldable navigation panel (`08fb7b6`,
  `3657f2c`).
- Configurable font families (`71aced8`) and a configurable look for the printed
  edition (`a832817`).
- An external link in the sample book (`fdcfafe`).

### Changed

- Internal PDF links land on the right page (`572cac4`), the running head was
  simplified and the folio centered (`df402c2`).
- The PDF builder was split into a Markdown → IR → TeX pipeline (`3822662`).
- Stylesheets became plain CSS files beside the code (`73db5e3`), and the
  preamble moved out of TypeScript into a `.tex` file using angle-bracket
  placeholders (`58e6b3e`, `0f8d915`).
- The linter checks only the docs a new book is sure to have (`2db71f7`), and an
  unbreakable line may exceed the column budget (`1ac66ab`).
- Link checking runs through lychee, resolving root-relative image links
  (`cd17f8d`).
