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

Hard-coded `lang="en"` in `_layouts/default.html` and `src/build-web-book/site.ts`.

- [ ] `language` key (default `"en"`), used for the `<html lang>` attribute
- [ ] feed the printed edition too: `babel`/`polyglossia` and hyphenation in
      `src/build-tex-book/preamble.tex`
- [ ] translate the fixed UI strings for a non-English book: "Previous", "Next",
      "Table of Contents" (`\contentsname`), the sidebar/nav ARIA labels
- [ ] document that it is not the same thing as the linter's `languages`

### 3. `web.css` escape hatch

The web's answer to `tex.preamble`; today the layout and CSS live in the package.

- [ ] `web.css` key naming a file, appended after the built-in stylesheet
- [ ] thread it through `stylesheet()` in `src/build-web-book/site.ts`
- [ ] consider a `web.head` string for extra `<head>` HTML (analytics, meta)
- [ ] decide whether the standalone `md` layout (`_layouts/default.html`) shares it

### 3b. Derive the web palette from `tex.colors`

The site carries a second, hard-coded palette (`--accent` and the `:root` block
in `_layouts/default.html`, plus `src/lib/content.css`) that can drift from
`tex.colors`.

- [ ] emit the web CSS variables from `CONFIG.tex.colors` in `src/lib/fonts.ts`
      or `src/build-web-book/site.ts`
- [ ] leave the site-only accent as its own key if it should differ

### 4. Linter budgets

Constants in `src/lint/markdown.ts`: `MAX_LINE = 100`, `MAX_TABLE_LINE = 240`,
`MAX_DIAGRAM_COLS = 80`.

- [ ] a `lint` block (`lint.proseWidth`, `lint.tableWidth`, `lint.diagramWidth`)
- [ ] thread them through `src/lint/chapter.ts` and the message strings
- [ ] expose it in the schema and the Configuration chapter

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
