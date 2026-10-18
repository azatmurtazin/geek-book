# TODO — Architecture Refactoring

Execution checklist for [`ARCHITECTURE_REFACTORING_PLAN.md`](./ARCHITECTURE_REFACTORING_PLAN.md).
Target: [`CLEAN_CODE_ARCHITECTURE.md`](./CLEAN_CODE_ARCHITECTURE.md) · Baseline: [`CURRENT_ARCHITECTURE.md`](./CURRENT_ARCHITECTURE.md).

**Status:** proposed; pre-P0 diagram guard landed · one phase = one PR = one green baseline.

## Invariants (every commit)

- [ ] Output byte-identical: web (sha256), PDF (text + pages + size), `config`, `md`
- [ ] Lint findings identical (messages, order, severity)
- [ ] Exit codes, config keys, CLI flags unchanged
- [ ] `just lint && just test && just html && just pdf` green
- [ ] `just verify` green
- [ ] New `dependency-cruiser` rules stay `warn` until Phase 8
- [ ] `tsc --noEmit` clean (strict + `verbatimModuleSyntax`)
- [ ] Never regenerate baseline/goldens to make a phase pass

## Phases

- [x] **pre-P0 — Diagram guard** (done)
  - [x] `test/fixtures/golden/diagram.md` + `test/diagrams/render.test.ts`
  - [x] Isolated, structural jsdom/Mermaid integration test (no SVG bytes frozen)
  - [ ] Moves to `test/adapters/diagrams/` in P8

- [ ] **P0 — Baseline + guardrails** (S/Low)
  - [ ] `tools/baseline/` + `just baseline`/`just verify`; capture `test/baseline/*` in Docker
  - [ ] `dependency-cruiser` at `warn` + `just boundaries`
  - [ ] `test/architecture.test.ts` (report-only)
  - [ ] Wire `boundaries` + `verify` into CI

- [ ] **P1 — Diagnostics kernel** (S/Low)
  - [ ] `domain/diagnostics.ts` (`Severity`, `Diagnostic`, `Result`, `ok`/`fail`)
  - [ ] ports `reporter` / `logger` + `adapters/reporting/console-reporter.ts`
  - [ ] Route `cli.ts`'s own messages through reporter; same exit codes
  - [ ] Tests: `diagnostics`, `console-reporter`

- [ ] **P2 — Domain model + values (behind shims)** (M/Med)
  - [ ] `domain/values/paths.ts` (branded paths; split if friction)
  - [ ] `domain/model/{toc,chapter,inline,assets}.ts`; `ir.ts` → shim
  - [ ] Move pure values (placeholders, ui-strings, geometry, palette, code-language, fonts, anchor/text, smart-typography engine)
  - [ ] Re-export shims at old paths; update narrow-signature call sites
  - [ ] Tests: `test/domain/*`

- [ ] **P3 — Markdown port + one walk** (L/High) ⚠ highest fidelity
  - [ ] `application/ports/markdown-parser.ts` (neutral `MdNode`/`MdInline`)
  - [ ] `adapters/markdown/marked-parser.ts` (sole `marked` consumer)
  - [ ] `domain/services/{assemble,resolve-links,resolve-images}.ts`; `domain/values/entities.ts`
  - [ ] Flip `build-tex-book/parse.ts`; delete `blocks/inlines/entities/links/images/state`
  - [ ] Watch: `token.escaped`, hard breaks, GFM table align, raw HTML, soft breaks, list `start`
  - [ ] Tests: `marked-parser`, `assemble`; TeX golden unchanged

- [ ] **P4 — One source pipeline** (M/Med)
  - [ ] Ports: `diagram-renderer`, `image-store`, `image-measurer`
  - [ ] Adapters: `mermaid-renderer`, `remote-image-store`, `image-measurer`
  - [ ] `application/pipelines/source-to-model.ts` (substitute → collect → extract → lex → render → assemble)
  - [ ] Both builders feed the pipeline (HTML still old renderer)
  - [ ] Tests: `source-to-model` with fake ports

- [ ] **P5 — Pure HTML renderer** (L/High) ⚠ byte fidelity
  - [ ] `adapters/render-html/*` (`renderChapterBody`, escape, site-meta, stylesheets, content.css, hrefFor/srcFor)
  - [ ] `adapters/web/*` (page-shell, navigation, website-writer, site.css)
  - [ ] Flip web build to `sourceToModel` + `renderChapterBody`; delete regex rewrites
  - [ ] Delete `marked` hooks + `build-web-book/{page,nav,links,site}.ts`
  - [ ] Watch: attribute order, whitespace/newlines, `<pre><code class>`, code-label wrapper, heading id
  - [ ] Tests: `html-renderer`; parity rebuilt on model

- [ ] **P6 — Lint on the model** (M/Med)
  - [ ] `domain/services/anchor-index.ts` (single anchor authority)
  - [ ] `application/usecases/lint-book.ts` → `Diagnostic[]`
  - [ ] `adapters/lint/{structural,link,style,config}-checks.ts`; keep raw-line style pass
  - [ ] Delete `src/lint/*`
  - [ ] Tests: `lint-book`; anchor parity; `lint.txt` identical

- [ ] **P7 — Use cases + composition root** (L/Med)
  - [ ] Ports: `file-system`, `http-client`, `process-runner`, `pdf-toolchain`, `template-store`, `config-source`
  - [ ] Adapters: `fs`, `http`, `process`, `templates`, `config`
  - [ ] `application/usecases/*` returning `Result`; settings → `BookSettings`
  - [ ] `cli/main.ts` composition root + thin `cli/commands/*`; delete `cli.ts`
  - [ ] Tests: `build-website`, `build-pdf` with in-memory fs + fake toolchain

- [ ] **P8 — Collapse, assets, enforce** (M/Low)
  - [ ] Delete all shims + `src/lib`
  - [ ] Move assets beside readers (layouts, CSS, preamble.tex)
  - [ ] All `dependency-cruiser` rules → `error`; `boundaries` in `lint`/CI
  - [ ] Update `README` + architecture docs; remove dead code

## Graduation

- [ ] `depcruise src` = 0 with all rules at `error`
- [ ] `grep 'from "marked"' src` → 1 path (`adapters/markdown/marked-parser.ts`)
- [ ] `jsdom`/`mermaid` → `adapters/diagrams/*` only
- [ ] `grep 'node:' src/domain src/application` → empty
- [ ] `src/{lib,build-web-book,build-tex-book,diagrams,md-to-html,lint}` gone
- [ ] `just verify` + `just test` + `just docker-book` green
- [ ] Docs describe the new layout; CI enforces boundaries + verify

## Escape hatches

- Phase is one PR; net effect additive or shimmed move → `git revert` restores.
- Baseline is the contract: a diff is a bug, never a baseline update.
- Only `src/` structure + tooling change; `bin/geek-book.mjs`, `book.config.json`, the guide stay untouched → pre-refactor engine always recoverable from `main`.
