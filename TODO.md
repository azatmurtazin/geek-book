# TODO

What in the engine is still hard-coded and could become a `book.config.json`
key, roughly cheapest and most-wanted first. Each item names the file that
carries the constant today, so the change is a matter of adding it to
`BookConfig` and `load()` in `src/lib/book-config.ts`.

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

- [x] add `{{ title }}`, `{{ author }}`, `{{ tagline }}` from the book config
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

- [x] emit the web CSS variables from `tex.colors` in `src/lib/fonts.ts`
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

- [x] `baseUrl` / base path — the site's root links, plus canonical and social
      tags when it is absolute (`web.baseUrl`)
- [x] `description`, Open Graph / Twitter card, and a `favicon` (`web.description`
      and `web.favicon`; the card tags live in `src/lib/site-meta.ts`)
- [x] header/footer links — repo, "edit this page", license (`web.links`, with
      `{path}` and `{url}` placeholders)

### Content authoring

Done. The `code` key maps a fence tag to a label and a comment style
(`src/lib/code-meta.ts`, resolved over the built-in table in `src/lib/langs.ts`);
a tag named there is also accepted by the linter.

- [x] a per-language label and comment style, so a book teaching a language
      outside the built-in set gets a label chip and comment highlighting
- [x] `{{ }}` tokens for arbitrary config values — superseded by the free-form
      `placeholders` map from item 1

### Markdown and rendering

- [ ] `marked` options in `src/md-to-html/render.ts`: `breaks` (single newline to
      `<br>`) — tried and reverted in `b47108f`: with `lint.proseWidth`
      hard-wrapping the prose, every source line break became a `<br>` (312 in
      the guide itself). If it comes back it belongs behind a config key,
      default off.
- [ ] smart typography (curly quotes, en/em dashes) — marked v18 ships no
      option for it, so a small custom extension or a dependency
- [ ] heading anchor style — shared with the linter, so riskier than it looks

### Diagrams

- [x] derive the mermaid palette (`src/diagrams/render.ts`) from `tex.colors`
      rather than the hard-coded grey, so diagrams follow the book automatically
- [ ] expose `theme` / font size if a book wants something other than the greys
      (still hardcoded: `FONT_SIZE = 13` and `theme: "default"` in
      `src/diagrams/render.ts`)

### Printed edition (`tex`)

- [x] `tex.class` and one- vs two-sided (`preamble.tex` is `book`, `oneside`; the
      running-head design assumes one-sided)
- [x] `tex.tocDepth` (`preamble.tex` sets `tocdepth` to chapters only)
- [ ] richer front matter (title page, colophon, copyright, ISBN) — `tex.preamble`
      covers it for now

### Layout

- [x] `readme` — names the web home page (default `<bookDir>/README.md`), easy
- [x] `chapters` — the prose directory (default `<bookDir>/chapters`); the
      SUMMARY prefix the linter keyed on now comes from the configured path

### Build and preview

- [x] `serve` default port (`src/serve/cli.ts`)
- [x] remote-image fetch timeout and accepted content types
      (`src/lib/remote-images.ts`)
- [x] incremental vs always-`rm -rf` rebuild (`src/build-web-book/cli.ts`)
- [ ] output naming / pretty URLs — deferred as risky; no key yet

## Deliberately not configurable

Heading slugs, callout and code-block markup, sidebar shape — these are the
book's visual identity, and `tex.preamble` plus a future `web.css` already let a
determined book override them. Turning them into keys only multiplies the schema.

---

## Tests and architecture

Unit tests for the two rendering pipelines (Markdown → HTML and Markdown →
LaTeX), the refactor that makes them testable, and the file splits that fall
out of it.

**Decision**: Vitest — popular, BDD-style (`describe`/`it`), TypeScript without
a loader, watch mode. It becomes the project's one test dependency, a
devDependency.

### Harness

- [ ] `test/` beside `src/`, mirroring its layout (`test/md-to-html/`,
      `test/build-tex-book/`, `test/lib/`)
- [ ] add `vitest` as a devDependency with a `test` script (`vitest run`), a
      `just test` recipe and a `pre-commit` hook after `lint`
- [ ] widen `tsconfig.json`'s `include` to cover `test/`, so `npm run
      typecheck` checks the tests too
- [ ] tests assert on strings and structures, never on `build/`; no LuaLaTeX or
      jsdom in the unit tier

### What is left before the pipelines are testable

Two of the three blockers are already cleared by the CONFIG refactor
(`a76f217`), which threads a `BookConfig` argument through every entry point
and replaces the global `marked.use` with the `markedInstance(cfg)` factory. A
differential build confirms it: pre- and post-refactor output is byte-identical.

- [x] the module-scope `CONFIG` singleton and its frozen constants
      (`TEXT_WIDTH_MM`, `colors`, `TEXT_STACK`, `ROOT`/`BOOK`) — `load()` is
      explicit now, so a test can build a fixture config and pass it in
- [x] `marked.use({…})` at module scope in `md-to-html/render.ts` — each
      pipeline now builds its own `Marked` instance in `src/lib/markdown.ts`
- [ ] `parseChapter` interleaves four jobs: placeholder substitution, remote image fetching,
      mermaid drawing, and the token walk. Split it so the walk
      is a pure `tokensToIr(markdown, ctx)` that a test can call with a stub
      context; leave fetching and mermaid in the async wrapper.

### Splitting the large files

Each file splits along the seams its own comments already describe; the entry
points and their exports stay put so the CLIs do not change. Line counts as of
`a76f217`.

- [ ] `src/lib/book-config.ts` (644) → `types.ts` (the interfaces),
      `defaults.ts`, `validators.ts` (the `as*` family), `load.ts`
- [ ] `src/build-tex-book/tex.ts` (372) → `escape.ts` (`texEscape`,
      `texEscapeCode`), `blocks.ts`, `inline.ts`, `figures.ts` (picture
      measuring), `tables.ts`
- [ ] `src/diagrams/render.ts` (356) → `theme.ts` (the `tex.colors` mapping),
      `shims.ts` (the jsdom measurement shims), `fixup.ts` (viewBox/text
      rewriting), `render.ts` (loader + entry points)
- [ ] `src/build-web-book/site.ts` (348) → `links.ts` (`rewriteLinks`,
      `rewriteImages`), `nav.ts` (sidebar + footer), `page.ts` (`assemblePage`,
      `headHtml`, `stylesheet`)
- [ ] `src/build-tex-book/parse.ts` (334) → `blocks.ts`, `inlines.ts`,
      `links.ts` (`linkTarget`), `images.ts` (`placeImage`), `entities.ts`

### md → html (`src/md-to-html/`)

- [ ] heading ids: slug rule, depth, and that the id matches what the linter
      expects (`slugify` in `src/lib/markdown.ts` is shared on purpose)
- [ ] code fences: `language-` class, the label chip from `code`, comment
      `<span>`s from `tokenizeCode`, escaping byte-for-byte
- [ ] single newlines stay soft — no `<br>` in hard-wrapped prose (the `b47108f`
      regression) — and GFM tables/lists/strikethrough round-trip
- [ ] placeholders substituted in prose, left alone inside fences
- [ ] `pageTitle` from the first `#`, and the layout's `{{ … }}` slots all filled
- [ ] `escapeHtml` on every interpolated value (title, tagline, code, links)

### md → tex (`src/build-tex-book/`)

- [ ] IR shape for each block kind: heading anchors (`c<id>` + slug),
      paragraphs, callouts, ordered lists and their `start`, aligned tables,
      rules, standalone images
- [ ] `linkTarget`: external URL → `null`, `.md` → `c<id>`, bare `#anchor`,
      unknown file → `null`
- [ ] `texEscape` / `texEscapeCode` over every special character
- [ ] serialization: heading commands by depth, `\\label` per anchor, list
      counters at depth > 0, table rules, `codebox` + `\\cc{}` comments,
      `\\hyperref` vs `\\href`
- [ ] picture fitting: `shrinkAxis` and the mm conversion, with and without a
      measurable header
- [ ] `preambleTex` expands `<<doc-class>>`, `<<side>>`, `<<toc-depth>>`,
      geometry and the nine colours

### Cross-pipeline parity

The one promise the engine makes is that both editions come from the same
source. Test it directly:

- [ ] the same heading produces the same anchor as an HTML `id` and a TeX
      `\\label`
- [ ] the same `{{ token }}` resolves to the same string in both
- [ ] the same fence produces a label chip in HTML and a label line in TeX
- [ ] a golden file: one fixture chapter through both pipelines, committed
      beside the tests, so a rendering change shows up as a diff

### Order

- [ ] harness first (Vitest, `test/`, tsconfig include), then the parity and
      pure-function tests, which pass against today's code and pin the current
      output
- [ ] then blocker 3 — the pure token walk — with those tests green throughout
- [ ] then the file splits, one commit each, no behaviour change
