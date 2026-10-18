# TODO — Architecture Refactoring

Execution checklist for [`ARCHITECTURE_REFACTORING_PLAN.md`](./ARCHITECTURE_REFACTORING_PLAN.md).
Target: [`CLEAN_CODE_ARCHITECTURE.md`](./CLEAN_CODE_ARCHITECTURE.md) · Baseline: [`CURRENT_ARCHITECTURE.md`](./CURRENT_ARCHITECTURE.md).

**Status:** in progress — P0 harness landed (PDF reference pending), P1–P4 done · one phase = one PR = one green baseline.

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

- [ ] **P0 — Baseline + guardrails** (S/Low) — harness landed; PDF reference pending
  - [x] `tools/baseline/` + `just baseline`/`just verify`; `test/baseline/*` (web, lint, config, md)
  - [ ] Capture `book.txt`/`book.info` in the pinned image (`just docker-baseline`) — needs a running Docker daemon
  - [x] `dependency-cruiser` at `warn` + `just boundaries` (SWC parser, since the repo tracks TypeScript 7)
  - [x] `test/architecture.test.ts` (report-only; `marked` importer allowlist)
  - [x] Wire `boundaries` (non-failing) + `verify` (failing) into CI

- [x] **P1 — Diagnostics kernel** (S/Low)
  - [x] `domain/diagnostics.ts` (`Severity`, `Diagnostic`, `Result`, `ok`/`fail`, `combine`, `mapResult`)
  - [x] ports `reporter` / `logger` + `adapters/reporting/{console-reporter,console-logger}.ts`
  - [x] Route `cli.ts`'s own messages through the reporter; usage text and exit codes unchanged
  - [x] Tests: `test/domain/diagnostics.test.ts`, `test/adapters/reporting/*`

- [x] **P2 — Domain model + values (behind shims)** (M/Med)
  - [x] `domain/values/paths.ts` (branded `BookPath`/`OutputPath`/`SourcePath`/`Anchor`; `Anchor` adopted by `slugify`, wider branding deferred to P8)
  - [x] `domain/model/{toc,inline,assets,chapter}.ts`; `ir.ts` → shim (`ChapterContext` stays for P4)
  - [x] Moved pure values: `placeholders`, `ui-strings`, `geometry` (`PAPERS` + `textBlock`), `palette`, `code-language`, `fonts`, `anchor`/`text`, the smart-typography engine
  - [x] Re-export shims at old paths; narrowed `commentStyle`/`codeLabel`/`tokenizeCode` to a code table
  - [x] Tests: `test/domain/values/*` (7 files)

- [x] **P3 — Markdown port + one walk** (L/High) ⚠ highest fidelity
  - [x] `application/ports/markdown-parser.ts` (neutral `MdNode`/`MdInline`, defined in `domain/model/markdown.ts`)
  - [x] `adapters/markdown/marked-parser.ts` (sole new `marked` consumer)
  - [x] `domain/services/{assemble,resolve-links,resolve-images}.ts`; `domain/values/{entities,posix-path}.ts`
  - [x] Flip `build-tex-book/parse.ts`; delete `blocks/inlines/entities/links/images/state`
  - [x] Watch: `token.escaped` (kept), hard breaks, GFM table align, raw HTML, soft breaks, list `start` (all verified)
  - [x] Tests: `marked-parser`, `assemble`; TeX golden + parity unchanged; real `book.tex`/PDF byte-identical

- [x] **P4 — One source pipeline** (M/Med)
  - [x] Ports: `diagram-renderer`, `image-store`, `image-measurer`
  - [x] Adapters: `mermaid-renderer`, `remote-image-store`, `image-measurer` (the measurer lands here, consumed in P7)
  - [x] `application/pipelines/source-to-model.ts` (substitute → collect → extract → lex → render → assemble)
  - [x] `domain/services/extract-diagrams.ts`; `diagrams/render.ts` keeps rendering only
  - [x] Both builders feed the pipeline (HTML still old renderer, via `renderPreparedBody` + `substituteDiagrams`)
  - [x] Tests: `source-to-model` with fake ports; `extract-diagrams`; `image-measurer`; real `book.tex`/diagram SVG byte-identical

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
