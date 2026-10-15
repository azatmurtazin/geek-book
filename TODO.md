# TODO — configuration improvements

What in the engine is still hard-coded and could become a `book.config.json`
key, roughly cheapest and most-wanted first. Each item names the file that
carries the constant today, so the change is a matter of routing it through
`CONFIG` (`src/lib/book-config.ts`).

The bias is escape hatches over one-key-per-knob. The printed edition already
has one — `tex.preamble` appends arbitrary LaTeX — and it absorbs a whole family
of requests that would otherwise each need a key. The web edition has no
equivalent yet, which is why `web.css` is near the top.

## Every new key touches the same places

Worth doing all of these for each key, or the config drifts from its schema:

- [ ] a property on `BookConfig` and a line in `load()` in `src/lib/book-config.ts`
- [ ] a lenient `as*` validator that falls back to the default, never throws
- [ ] the matching property in `book.schema.json`
- [ ] a row in the keys table in `book/chapters/03_config/00_index.md`
- [ ] prose where the key belongs in the guide
- [ ] `geek-book lint config` still clean (it validates against the schema)

## First batch

Small, independent, and covers the most ground.

### 1. Expand the content placeholder tokens

Done. The built-in tokens are now `version`, `title`, `author` and `tagline`,
and the free-form `placeholders` map adds more (`src/lib/content-placeholders.ts`).

- [x] add `{{ title }}`, `{{ author }}`, `{{ tagline }}` from `CONFIG`
- [x] optionally a free-form `"placeholders": { "edition": "2nd" }` map merged in
- [x] document it in `book/chapters/01_writing/03_chapters.md` (the
      "Placeholders" section)
- [x] keep fenced blocks byte-for-byte, as the substitution already does

### 2. `language`

Done. `language` (BCP 47, default `en`) sets the `<html lang>` attribute and the
printed edition's babel/hyphenation; a `strings` map overrides the fixed UI
labels, English by default.

- [x] `language` key (default `"en"`), used for the `<html lang>` attribute
- [x] feed the printed edition too: `babel`/`polyglossia` and hyphenation in
      `src/build-tex-book/preamble.tex`
- [x] translate the fixed UI strings for a non-English book: "Previous", "Next",
      "Table of Contents" (`\contentsname`), the sidebar/nav ARIA labels
- [x] document that it is not the same thing as the linter's `languages`

### 3. `web.css` escape hatch

Done. `web.css` names a stylesheet appended after the built-in one and
`web.head` a file of `<head>` HTML; both are files, like `tex.preamble`. The
standalone `md` layout is not the website and does not share them.

- [x] `web.css` key naming a file, appended after the built-in stylesheet
- [x] thread it through `stylesheet()` in `src/build-web-book/site.ts`
- [x] consider a `web.head` string for extra `<head>` HTML (analytics, meta)
- [x] decide whether the standalone `md` layout (`_layouts/default.html`) shares it

### 3b. Derive the web palette from `tex.colors`

Done. `src/lib/web-palette.ts` turns the nine `tex.colors` into the web custom
properties both targets share; the site-only colours (accent, backgrounds,
zebra) stay in their stylesheets, and the night palette remains the engine's.

- [x] emit the web CSS variables from `CONFIG.tex.colors` in `src/lib/fonts.ts`
      or `src/build-web-book/site.ts`
- [x] leave the site-only accent as its own key if it should differ

### 4. Linter budgets

Done. A `lint` block (`lint.proseWidth` 100, `lint.tableWidth` 240,
`lint.diagramWidth` 80) drives the chapter check; the constants that used to
live in `src/lint/markdown.ts` are gone.

- [x] a `lint` block (`lint.proseWidth`, `lint.tableWidth`, `lint.diagramWidth`)
- [x] thread them through `src/lint/chapter.ts` and the message strings
- [x] expose it in the schema and the Configuration chapter

## Backlog

Larger or narrower; pick by demand.

### Site and metadata (web)

- [ ] `baseUrl` / base path — the layout links the brand and Home to `/`, so a
      GitHub Pages *project* site under `/repo/` breaks; also feeds canonical and
      OG tags
- [ ] `description`, Open Graph / Twitter card, and a `favicon`
- [ ] header/footer links — repo, "edit this page", license (the footer today is
      just `title version — tagline` in `src/build-web-book/site.ts`)

### Content authoring

- [ ] extend `src/lib/langs.ts`: a per-language label (`CODE_LABELS`) and comment
      style, so a book teaching a language outside the built-in set gets a label
      chip and comment highlighting
- [ ] `{{ }}` tokens for arbitrary config values (superseded by item 1 if the
      free-form map lands)

### Markdown and rendering

- [ ] `marked` options in `src/md-to-html/render.ts`: `breaks` (single newline to
      `<br>`), smart typography
- [ ] heading anchor style — shared with the linter, so riskier than it looks

### Diagrams

- [ ] derive the mermaid palette (`src/diagrams/render.ts`) from `tex.colors`
      rather than the hard-coded grey, so diagrams follow the book automatically
- [ ] expose `theme` / font size if a book wants something other than the greys

### Printed edition (`tex`)

- [ ] `tex.class` and one- vs two-sided (`preamble.tex` is `book`, `oneside`; the
      running-head design assumes one-sided)
- [ ] `tex.tocDepth` (`preamble.tex` sets `tocdepth` to chapters only)
- [ ] richer front matter (title page, colophon, copyright, ISBN) — `tex.preamble`
      covers it for now

### Layout

- [ ] `readme` — the web home page (`<bookDir>/README.md`), easy
- [ ] `chapters` — more invasive: the `chapters/` prefix is baked into the summary
      convention (`src/lint/summary.ts`), the `.md` to `.html` mapping, and the
      group-index rules, so relocating it means following that prefix everywhere

### Build and preview

- [ ] `serve` default port (`src/serve/cli.ts`)
- [ ] remote-image fetch timeout and accepted content types
      (`src/lib/remote-images.ts`)
- [ ] incremental vs always-`rm -rf` rebuild (`src/build-web-book/cli.ts`)
- [ ] output naming / pretty URLs

## Deliberately not configurable

Heading slugs, callout and code-block markup, sidebar shape — these are the
book's visual identity, and `tex.preamble` plus a future `web.css` already let a
determined book override them. Turning them into keys only multiplies the schema.
