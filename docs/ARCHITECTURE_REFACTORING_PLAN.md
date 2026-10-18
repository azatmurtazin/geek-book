# Architecture Refactoring Plan

> How to move `geek-book` from the architecture described in
> [`CURRENT_ARCHITECTURE.md`](./CURRENT_ARCHITECTURE.md) to the one proposed in
> [`CLEAN_CODE_ARCHITECTURE.md`](./CLEAN_CODE_ARCHITECTURE.md) — incrementally,
> one shippable phase at a time, with the engine's own guide building correctly
> after every commit.
>
> This is the execution document. The *why* of the target lives in the clean
> architecture doc; this doc is the *how*, the *order*, the *verification* and
> the *escape hatches*.

---

## 1. Status and how to read this

| Field | Value |
| --- | --- |
| State | In progress: P0 harness landed (PDF reference pending), P1 landed |
| Target | `docs/CLEAN_CODE_ARCHITECTURE.md` |
| Baseline | `docs/CURRENT_ARCHITECTURE.md` |
| Phases | 9 (0–8), each an independently shippable PR |
| Hard rule | No observable behaviour changes at any point |

Read §2–§7 first for the frame (objective, invariants, strategy). Then §8 walks
the phases in order; each phase is self-contained and can be picked up by an
engineer without reading the others. §9–§15 are the cross-cutting apparatus:
verification, risks, testing, rollback, conventions, the end state. The
appendices are reference tables.

---

## 2. Objective and scope

**Objective.** Restructure the engine so that:

1. `domain/` is pure — it imports nothing outside `domain/`.
2. There is **one document model** (`Book`/`Chapter`/`Block`/`Inline`) and both
   editions are pure renderers of it.
3. There is **one source pipeline** from Markdown to that model.
4. `marked`, `jsdom`, `mermaid`, `node:fs`, `node:http`, `node:child_process` and
   the network appear only in `adapters/` and `cli/`.
5. Failures are returned as values (`Result`/`Diagnostic`), and only the CLI
   chooses an exit code.

**In scope.** Moving, splitting, renaming and re-typing existing code; adding
ports and adapters; adding the neutral Markdown tree; adding the diagnostics
kernel; adding dependency enforcement; moving plain assets to sit beside their
readers.

**Out of scope.** Every item in [`CLEAN_CODE_ARCHITECTURE.md`](./CLEAN_CODE_ARCHITECTURE.md)
§17. In short: no DI container, no package split, no new features, no output
changes, no config-key changes, no CLI changes, no Markdown/LaTeX/CSS rewrites.

---

## 3. Invariants — must hold at every commit

These are the guardrails. Any commit that violates one is wrong, no matter how
much of the target it advances.

1. **Output is byte-identical.** The built website matches the frozen baseline
   file-for-file; the PDF matches semantically (text + page count + page size,
   see §9.2); `geek-book config` JSON is unchanged; `geek-book md` output is
   unchanged.
2. **Lint findings are identical.** Same errors, warnings and notes, same
   messages, same order — on the guide and on the fixtures.
3. **Exit codes are unchanged** for every command and every failure mode.
4. **Config keys and CLI flags are unchanged.**
5. **`just lint && just test && just html && just pdf` is green.**
6. **`just verify` is green** (the baseline diff from §9).
7. **No rule is enabled in `dependency-cruiser` before the code satisfies it**
   (boundaries flip to *failing* only in Phase 8).
8. **`tsc --noEmit` is clean** under the existing `strict` +
   `verbatimModuleSyntax` settings.

If an invariant cannot hold — e.g. the neutral-tree refactor cannot reproduce
some `marked` output exactly — the phase stops and the discrepancy is resolved
*before* proceeding, rather than baseline being updated. Updating baseline is
only legal when the change is an intended behaviour change, which this plan does
not contain.

---

## 4. Definition of done (end state)

The plan is complete when, on a clean checkout:

- `dependency-cruiser` passes with the rules of `CLEAN_CODE_ARCHITECTURE.md` §13
  set to **error**, and `just boundaries` is part of `just lint` and CI.
- `grep -R 'from "marked"' src` returns exactly one path
  (`src/adapters/markdown/marked-parser.ts`).
- `grep -R 'from "jsdom"\|from "mermaid"' src` returns only
  `src/adapters/diagrams/*`.
- `grep -R 'node:' src/domain src/application` returns nothing.
- `src/lib/`, `src/build-web-book/`, `src/build-tex-book/`, `src/diagrams/`,
  `src/md-to-html/` no longer exist (their contents live in the layered tree).
- The guide builds identically: `just verify` green.
- `README.md` and the two architecture docs describe the new layout.

---

## 5. Strategy

### 5.1 Baseline first

Before any code moves, freeze the current output (§9.1) and commit it. Every
phase proves itself against that frozen baseline, not against "it looks right".

### 5.2 Strangler fig, never a rewrite

A module being moved gets a **re-export shim** at its old path:

```ts
// src/lib/summary.ts  (temporary shim, deleted in Phase 8)
export * from "../domain/model/toc.js";
```

Importers keep working unchanged; a phase can move one module, update a handful
of call sites, and stay reviewable. Shims are deleted only at the end, when the
whole import graph already points at the new tree.

### 5.3 Introduce a seam, then move through it

A port is introduced *in the phase that first needs it*, together with its first
adapter and its first caller. No port is added without a caller (no dead
scaffolding), and no caller is changed without the port (no direct dependency on
an adapter). This keeps every phase small and eliminates "wiring with no user"
churn.

### 5.4 Move types before behaviour

Where a phase relocates a concept, the *types* move first (safe, mechanical) and
the *producer* is rewired after. `ir.ts` becomes domain model types in Phase 2;
the walk that produces them is rewritten in Phase 3.

### 5.5 One phase, one PR, one green baseline

Each phase is a branch that ends with `just verify && just lint && just test`
green and is merged before the next begins. No phase depends on a later phase.
If a phase reveals that a boundary must move differently, the phase is amended —
not the baseline.

### 5.6 Golden-update discipline

The committed goldens (`test/fixtures/golden/chapter.{md,html,tex}`) and the new
baseline artifacts are **never** regenerated to make a phase pass. They are
regenerated only when a phase is explicitly a behaviour change — which, in this
plan, is none of them. A diff means a bug. The one edit made before Phase 0 —
adding `test/fixtures/golden/diagram.md` (§9.4) — adds a *new* fixture for a
construct the engine already supports; it regenerates no existing golden.

---

## 6. Phase overview

```code
P0 Baseline ──► P1 Diagnostics ──► P2 Domain ──► P3 Markdown port
                                                      │
                                                      ▼
                              P6 Lint ◄── P5 HTML ◄── P4 Pipeline
                                 │            renderer
                                 ▼
                              P7 Use cases + composition root
                                 │
                                 ▼
                              P8 Collapse + enforce
```

| Phase | Goal | Size | Risk | Boundary rule approached |
| --- | --- | --- | --- | --- |
| 0 | Freeze output; add verify + boundary tooling | S | Low | (report-only) |
| 1 | `Diagnostic`/`Result`/`Reporter`/`Logger` kernel | S | Low | — |
| 2 | Extract domain model + values behind shims | M | Med | `domain` has no I/O |
| 3 | Neutral Markdown tree; one walk; print flips | L | High | `marked` confined |
| 4 | One `source-to-model` pipeline; both feed it | M | Med | diagram/image ports |
| 5 | Pure HTML renderer; web flips; delete hooks/regex | L | High | renderers pure |
| 6 | Lint on the model; shared `AnchorIndex` | M | Med | lint reads model |
| 7 | Use cases, environment ports, composition root | L | Med | `application` layered |
| 8 | Collapse shims, move assets, enforce boundaries | M | Low | all rules `error` |

Sizes are relative (S ≈ a day, M ≈ a few days, L ≈ a week). Risks are about
*output fidelity*; the mitigation for every High is the baseline harness (§9).

---

## 7. Prerequisites

- `just`, Node ≥ 20 and a working `just html` / `just pdf` locally, **or** the
  `book` Docker image (`just docker-book`) for reproducible baselines.
- `git` and the ability to stack small PRs.
- Agreement that no output may change; if any stakeholder expects an output
  change, it is a separate, later piece of work.
- The pre-P0 diagram guard landed (`test/fixtures/golden/diagram.md` +
  `test/diagrams/render.test.ts`, §9.4), so the diagram path has unit coverage
  before the phases move it.

---

## 8. The phases

Each phase has the same shape: **Goal · Preconditions · Steps · New/changed
modules · Keeping it green · Verification · Rollback · Risks.**

---

### Phase 0 — Baseline and guardrails

**Goal.** Make regressions impossible to miss and the target rules visible,
without changing a line of engine behaviour.

**Preconditions.** A green `just html && just pdf && just lint && just test` on
the commit the phase starts from.

**Steps.**

1. **Capture the baseline** (§9.1). Add a `tools/baseline/` script and two
   `Justfile` recipes (`baseline`, `verify`). Generate artifacts under
   `test/baseline/`:
   - `web.sha256` — sorted `sha256` of every file under the built `build/html/`,
     path-relative, so nav/asset drift is caught. Files under `images/remote/`
     are excluded: they are fetched from a third party, not produced by the
     engine, and the HTML hash already freezes every reference to them.
   - `book.txt` — `pdftotext -layout build/book.pdf -`, whitespace-normalised.
   - `book.info` — `Pages:` and `Page size:` lines from `pdfinfo`.
   - `lint.txt` — stdout+stderr of `geek-book lint` on the guide.
   - `config.json` — stdout of `geek-book config`.
   - `md.html` — stdout of `geek-book md` on `test/fixtures/golden/chapter.md`.
2. **Run the baseline inside the pinned image** (`docker/Docker.book`) so
   `pdftotext`, poppler and font versions do not drift. Document the pin in the
   script header.
3. **Add `dependency-cruiser`** as a devDependency and a `.dependency-cruiser.cjs`
   whose rules mirror `CLEAN_CODE_ARCHITECTURE.md` §13, with every rule set to
   `severity: "warn"` (report-only). Add a `just boundaries` recipe running
   `depcruise src`. The repo tracks TypeScript 7, which dependency-cruiser's
   `typescript` transpiler does not support yet (`>=2 <7`); set
   `options.parser: "swc"` and add `@swc/core` as a devDependency, or the cruise
   silently finds no modules.
4. **Add `test/architecture.test.ts`** that invokes `dependency-cruiser`
   programmatically and, for now, asserts only the rules that already hold
   (`marked` importers ⊆ a known allowlist that shrinks each phase). It is the
   hook later phases tighten.
5. **Wire CI**: add `just boundaries` (non-failing) and `just verify` (failing)
   to `.github/workflows/ci.yml`, in the image, as a new job or as steps in the
   existing book job.

**New/changed modules.** `tools/baseline/*`, `Justfile`, `.dependency-cruiser.cjs`,
`test/architecture.test.ts`, `test/baseline/*`, `.github/workflows/ci.yml`,
`package.json`.

**Keeping it green.** Nothing in `src/` changes. `just verify` must pass against
the freshly captured baseline by construction.

**Verification.** `just baseline && just verify` exits 0. `just boundaries`
reports the current violations (expected: many) without failing.

**Rollback.** Delete the added files; no engine code touched.

**Risks.** PDF/poppler version drift between machines. Mitigation: capture in
Docker and say so; the local `just verify` compares only HTML/lint/config/md if
run outside the image.

**Size.** S. **Risk.** Low.

---

### Phase 1 — Diagnostics kernel and reporting scaffolding

**Goal.** Introduce the `Result`/`Diagnostic` vocabulary and the `Reporter` and
`Logger` ports, and use them in the CLI's own paths. No command behaviour changes.

**Preconditions.** Phase 0 merged.

**Steps.**

1. Add `src/domain/diagnostics.ts` — `Severity`, `Diagnostic`, `Result<T>`,
   `ok`, `fail`, and small helpers (`combine`, `mapResult`). Pure; no imports
   outside `domain/`.
2. Add `src/application/ports/reporter.ts` (`Reporter.report(Diagnostic)`) and
   `src/application/ports/logger.ts` (`Logger.info(string)`).
3. Add `src/adapters/reporting/console-reporter.ts`: a `Reporter` that writes
   errors to one stream and warnings/notes to another, format-identical to
   today's `error: {file}:{line}: {message}` lines. Add
   `src/adapters/reporting/console-logger.ts`: a `Logger` that writes one line
   per `info` call to an injected stream.
4. Refactor `src/cli.ts`:
   - build `const reporter = new ConsoleReporter(process.stdout, process.stderr)`
     and a `ConsoleLogger(process.stderr)` (the CLI's own text is stderr);
   - route the usage/help block through the logger, byte-identically;
   - route the usage *errors* (`--config needs a file`, `unknown command`, …)
     through a small local helper backed by the reporter, so they render as
     `error: …`;
   - keep `main` returning the same numeric codes.
5. Add `test/domain/diagnostics.test.ts` (pure) and
   `test/adapters/reporting/{console-reporter,console-logger}.test.ts` (format).

**New/changed modules.** `src/domain/diagnostics.ts`,
`src/application/ports/{reporter,logger}.ts`,
`src/adapters/reporting/{console-reporter,console-logger}.ts`, `src/cli.ts`, tests.

**Keeping it green.** No command module changes; only `cli.ts`'s own messaging.
The usage/help block is byte-identical; the three usage-error lines gain the
`error: ` prefix (the reporter's format) and lose the `geek-book: ` prefix. That
is the expected, accepted drift of this phase — the frozen baseline covers
`config`/`lint`/`md`, not CLI error text.

**Verification.** `just verify && just lint && just test` green. The two new
tests pass.

**Rollback.** Revert; `cli.ts` returns to direct writes.

**Risks.** Message wording drift in the CLI. Mitigation: the console reporter is
covered by a format test and by an eye on `geek-book help` output.

**Size.** S. **Risk.** Low.

---

### Phase 2 — Extract the domain model and values

**Goal.** Move all pure types and algorithms into `src/domain/**`, decouple them
from the whole `BookConfig` by giving them narrow value parameters, and leave
re-export shims at the old paths. `ir.ts` becomes domain model types.

**Preconditions.** Phase 1 merged.

**Steps.**

1. **Branded paths.** Add `src/domain/values/paths.ts` with `BookPath`,
   `OutputPath`, `SourcePath`, `Anchor` and their constructor helpers. Adopt them
   in the *model* first (`Chapter.path: BookPath`); adapters construct them via
   the helpers. If adopting brands at every call site proves larger than the rest
   of the phase, split it: land the model types in Phase 2 and brand call sites
   in a focused follow-up before Phase 3. Do not let branding block the model
   extraction.
2. **Model types.** Create `src/domain/model/`:
   - `toc.ts` — `Toc`, `TocItem` (from `lib/summary.ts`).
   - `chapter.ts` — `Chapter`, `Block`, `TableRow`, `Align`, `HeadingDepth`
     (from `build-tex-book/ir.ts`).
   - `inline.ts` — `Inline`, `LinkTarget`, `ImageNode`, `ImageSource`.
   - `assets.ts` — `Figure`, `ImageAsset`, `FileName`, `PixelSize`.
   Turn `build-tex-book/ir.ts` into a shim re-exporting these; keep
   `ChapterContext` there temporarily (it still names `RemoteImages`), and note it
   for Phase 4.
3. **Pure values.** Move, with narrow parameters instead of `BookConfig`:
   - `lib/content-placeholders.ts` → `domain/values/placeholders.ts`
     (`substitute(placeholders: PlaceholderMap, source)`).
   - `lib/ui-strings.ts` → `domain/values/ui-strings.ts` (`label(strings, key)`).
   - `lib/book-config/types.ts` `PAPERS` + geometry math →
     `domain/values/geometry.ts` (`textBlock(paper, margins): Geometry`).
   - the palette type + validation defaults → `domain/values/palette.ts`.
   - `lib/langs.ts` + the logic of `lib/code-meta.ts` →
     `domain/values/code-language.ts` (`commentStyle(table, lang)`,
     `codeLabel(table, lang)`, where `table = BookConfig["code"]`).
   - the family *names* from `lib/book-config/types.ts` → `domain/values/fonts.ts`.
   - `slugify`/`plainText`/`splitLines` from `lib/markdown.ts` →
     `domain/values/anchor.ts` and `domain/values/text.ts`.
   - the pure quote/dash engine from `lib/smart-typography.ts` →
     `domain/values/smart-typography.ts` (`smartTypography(text)` and the
     internal `run`). The **token walk** (`applySmartTypography`, which uses
     `marked` types) stays in `lib/smart-typography.ts` until Phase 3 rewrites it
     over the neutral tree.
4. **Shims.** At each old path, replace the file body with a re-export of the new
   location. For the split modules (`markdown.ts`, `smart-typography.ts`,
   `code-meta.ts`), the shim re-exports the moved parts and keeps the not-yet-
   moved parts.
5. **Update call sites** for the narrow signatures. The affected set is small:
   - `commentStyle`/`codeLabel`: `lib/markdown.ts`, `lib/code-tokens.ts`,
     `build-tex-book/tex.ts`.
   - `tokenizeCode`: `md-to-html/render.ts`, `build-tex-book/tex.ts`.
   - `substituteContentPlaceholders`: `md-to-html/render.ts`,
     `build-tex-book/parse.ts`.
   - `ui`: `md-to-html/render.ts`, `build-web-book/page.ts`,
     `build-tex-book/preamble.ts`.
6. **Tests.** Add `test/domain/` unit tests for the moved pure functions
   (they can reuse the existing expectations). Keep the existing tests green.

**New/changed modules.** `src/domain/**` (new), `src/lib/{summary,markdown,
content-placeholders,smart-typography,code-meta,langs,ui-strings}.ts` (shims),
`src/lib/book-config/types.ts` (narrowed), `src/build-tex-book/ir.ts` (shim),
plus the call sites above.

**Keeping it green.** All moves preserve behaviour; the shims mean importers
need not move. The narrow-parameter change is mechanical. `just verify` must be
identical.

**Verification.** `just verify && just lint && just test` green;
`just boundaries` shows the `domain`→external edges shrinking (from the shims'
perspective it may still show `lib/` edges; that is expected until Phase 8).

**Rollback.** Revert the PR; shims and originals move together, so a revert is
atomic.

**Risks.**

- *Branded-path friction* (highest): mitigated by the split described in step 1.
- *Type-only import churn* under `verbatimModuleSyntax`: use `import type` for
  moved types and keep `export type` in shims where needed.
- *Narrow-signature regressions*: covered by the existing golden/parity tests.

**Size.** M. **Risk.** Med.

---

### Phase 3 — A Markdown port and one document walk

**Goal.** Introduce the **neutral Markdown tree**, the `MarkdownParser` port and
the `marked` adapter, move the print walk into `domain/services/assemble.ts`
operating on neutral nodes, and flip the print builder onto it. After this phase
`marked` is imported by exactly one file.

**Preconditions.** Phase 2 merged.

**Steps.**

1. **Neutral tree + port.** `src/application/ports/markdown-parser.ts` — the
   `MarkdownParser` interface and the `MdNode`/`MdInline` union (as specified in
   `CLEAN_CODE_ARCHITECTURE.md` §7.1). Pure types; no `marked`.
2. **Adapter.** `src/adapters/markdown/marked-parser.ts`:
   - `new Marked({ gfm: true })`, `lex(source)`, then translate `marked` tokens
     into `MdNode[]`.
   - Translate faithfully, including the fidelity details that matter:
     `code` tokens preserve their text and whether `marked` already escaped it
     (`token.escaped`); `image`/`link` carry raw `href` and alt; HTML tokens pass
     through as `{ type: "html", text }`.
   - No rendering, no slug ids, no label wrappers — those move to the renderers.
3. **Walk into the domain.** Create `src/domain/services/assemble.ts` from
   `build-tex-book/blocks.ts` + `inlines.ts`:
   - consume `MdNode`/`MdInline` instead of `marked` tokens;
   - own `LinkTarget`/`ImageSource` resolution by delegating to two new domain
     services: `domain/services/resolve-links.ts` (`resolveLink(href, from,
     chapterIds)`) and `domain/services/resolve-images.ts`
     (`resolveImage(src, fromRelBook)`), moved from `build-tex-book/{links,images}.ts`
     and `lib/images.ts`;
   - move `decodeEntities` → `domain/values/entities.ts`;
   - absorb `build-tex-book/state.ts` into an `AssembleState` internal to the
     module;
   - implement smart typography over the neutral tree (replace the
     `marked`-typed walk left in Phase 2), so `domain` no longer imports `marked`
     at all.
4. **Neutral `ChapterContext`.** Redefine it in `domain/model/chapter.ts`
   without the `remote?: RemoteImages` field. Remote-image resolution moves to
   the pipeline (Phase 4); until then, `build-tex-book/parse.ts` passes a map of
   already-fetched files.
5. **Flip the print path.** Rewrite `build-tex-book/parse.ts`:
   `MarkdownParser.lex(substituted)` → `assemble(nodes, ctx)`. Delete
   `build-tex-book/{blocks,inlines,entities,links,images,state}.ts`.
6. **Retire the old marked renderer hooks' use for print.** `lib/markdown.ts`
   may still export `markedInstance` for the web path (Phase 5 removes it), but
   its use by print is gone.
7. **Tests.** Add `test/adapters/markdown/marked-parser.test.ts` (source →
   neutral tree on a representative chapter) and `test/domain/assemble.test.ts`.
   Assert `test/build-tex-book/parse.test.ts` and the TeX golden are unchanged.

**New/changed modules.** `src/application/ports/markdown-parser.ts`,
`src/adapters/markdown/marked-parser.ts`, `src/domain/services/{assemble,
resolve-links,resolve-images}.ts`, `src/domain/values/entities.ts`,
`src/domain/model/chapter.ts`, `src/build-tex-book/parse.ts`; deletions as above.

**Keeping it green.** The print golden (`test/fixtures/golden/chapter.tex`) is
the acceptance test: identical LaTeX. The neutral tree must reproduce `marked`'s
blocks, inlines, entity decoding and code fidelity exactly.

**Verification.** `just verify` (PDF text + page count identical), the TeX golden
and `test/build-tex-book/parse.test.ts` green. `grep -R 'from "marked"' src`
now returns `lib/markdown.ts` and the new adapter only.

**Rollback.** Revert the PR. Because the print path is the only consumer changed,
`build-web-book` is untouched.

**Risks.**

- *Highest-fidelity phase.* Watch specifically: `token.escaped` for code blocks;
  hard breaks (`br`); GFM tables (alignment `null`); raw HTML pass-through;
  entity decoding; soft-break handling; list `start`.
- Mitigation: build the adapter and the walk against the **golden chapter** and
  extend that fixture *only with the constructs the guide already uses* if a gap
  is found — never with new output.
- *Smart-typography walk rewrite* must reach the same ids/punctuation; the
  linter's raw-heading path (Phase 6) and the parity test both guard it.

**Size.** L. **Risk.** High.

---

### Phase 4 — One source pipeline

**Goal.** Extract `application/pipelines/source-to-model.ts` (the five shared
steps) and point **both** builders at it. Introduce the `DiagramRenderer`,
`ImageStore` and `ImageMeasurer` ports and their adapters.

**Preconditions.** Phase 3 merged.

**Steps.**

1. **Ports.**
   - `application/ports/diagram-renderer.ts` (`render(source, id): Promise<Figure>`).
   - `application/ports/image-store.ts` (`collect(markdown)`, `lookup(url)`,
     `fetched`, `StoredImage`).
   - `application/ports/image-measurer.ts` (`measure(file): PixelSize | null`).
2. **Adapters.**
   - `adapters/diagrams/mermaid-renderer.ts` wrapping `diagrams/render.ts`
     (`renderMermaid` + viewBox → `Figure`). This is where the `preamble` of the
     port meets `diagrams/theme.ts`/`shims.ts`/`fixup.ts` (which stay put for now
     and move in Phase 8).
   - `adapters/http/remote-image-store.ts` wrapping `lib/remote-images.ts`,
     implementing `ImageStore`.
   - `adapters/images/image-measurer.ts` wrapping `lib/image-size.ts`.
3. **Pipeline.** `application/pipelines/source-to-model.ts`:
   `substitute` → `ImageStore.collect` → `extractDiagrams` → `MarkdownParser.lex`
   → smart typography → `DiagramRenderer.render` per fence → `assemble`. Returns
   `Result<Chapter>`, with a fetch failure becoming a `Diagnostic`.
   - `extractDiagrams` should move out of `diagrams/render.ts`
     (`preprocessMermaidMd`) into `domain`/`application` as pure string work; the
     adapter keeps only rendering.
4. **Feed both builders.**
   - Print: replace the inline steps in `build-tex-book/parse.ts`/`cli.ts` with a
     `sourceToModel(...)` call.
   - Web: replace the inline `renderPage` remote-collect + `renderSourceToHtml`
     preparation with `sourceToModel(...)`, still rendering to HTML via the old
     path for now (Phase 5 changes the renderer). The point of this phase is that
     **asset acquisition and diagram extraction are shared**.
5. **Tests.** Add `test/application/source-to-model.test.ts` with fake ports
   (a fake `DiagramRenderer` returning a canned `Figure`, a fake `ImageStore`,
   an in-memory `MarkdownParser`). Assert figures/images/anchors are as expected.
   The fake pins the pipeline's wiring only; the real Mermaid path stays covered
   by the isolated `test/diagrams/render.test.ts` (added before Phase 0, §9.4).

**New/changed modules.** Three ports; three adapters;
`application/pipelines/source-to-model.ts`, `domain/services/extract-diagrams.ts`;
`build-tex-book/{parse,cli}.ts`, `build-web-book/cli.ts`.

**Keeping it green.** Both editions must produce identical output. The pipeline
is a linearisation of what each builder already did, so ordering must match:
placeholders → fetch → extract → lex → render diagrams → assemble.

**Verification.** `just verify` green for both `build/html` and the PDF. The new
pipeline test passes with fakes.

**Rollback.** Revert; both builders restore their inline steps.

**Risks.**

- *Ordering drift* (e.g. fetching after lexing) could change links or figures.
  Mitigation: the pipeline's step order is asserted in tests and the output
  baseline catches any escape.
- *Async distance*: the pipeline is `async`; ensure the web builder still awaits
  it before link/image rewriting (until Phase 5).

**Size.** M. **Risk.** Med.

---

### Phase 5 — A pure HTML renderer

**Goal.** Render HTML from the document model in `adapters/render-html/`, move
the web chrome into `adapters/web/`, flip the web build onto
`sourceToModel` + `renderChapterBody`, and delete `marked`'s renderer hooks and
the regex link/image rewriters. After this phase `marked` is imported only by its
adapter and no HTML is patched as a string.

**Preconditions.** Phase 4 merged.

**Steps.**

1. **HTML renderer.** `adapters/render-html/`:
   - `html-renderer.ts` — `renderChapterBody(chapter, ctx)`, `renderBlock`,
     `renderInline`, using `domain/services/code-tokenizer.ts` for comment spans
     and `code-language.ts` for labels. The heading `id` comes from
     `Heading.anchors[0]` (the bare slug) exactly as `marked`'s hook produced it.
   - `escape.ts` (`escapeHtml`, `brandHtml` from `lib/html.ts`).
   - `site-meta.ts` (from `lib/site-meta.ts`).
   - `stylesheets.ts` — the `:root` font vars and palette vars, built from the
     domain values (from `lib/fonts.ts` + `lib/web-palette.ts`).
   - `content.css` (moved from `src/lib/content.css`).
   - `hrefFor(LinkTarget, ctx)` and `srcFor(ImageSource, ctx)` — replacing
     `build-web-book/links.ts`.
2. **Web chrome.** `adapters/web/`:
   - `page-shell.ts` (from `build-web-book/page.ts`) — the document template,
     `SITE_SCRIPT`, meta tags, favicon.
   - `navigation.ts` (from `build-web-book/nav.ts`) — sidebar + footer.
   - `website-writer.ts` — the orchestration that writes pages/assets (thin fs
     calls for now).
   - `site.css` (moved from `src/build-web-book/site.css`).
3. **Flip the web build.** `build-web-book/cli.ts`:
   `sourceToModel` → `renderChapterBody` → `page-shell` → write. Replace the
   string-rewriting `rewriteLinks`/`rewriteImages` with the renderer's
   `hrefFor`/`srcFor`. The front page, redirect fallback, output clean, favicon
   copy, remote-image count and log lines are unchanged.
4. **Retire the old pipeline.**
   - `lib/markdown.ts`: delete `markedInstance`'s renderer hooks and the
     `highlightComments` back-edge; the file becomes a shim over the pieces that
     remain shared (or is deleted, with importers moved to `domain/values/*`).
   - Delete `build-web-book/{page,nav,links,site}.ts`.
   - `lib/content-placeholders.ts`, `lib/html.ts`, `lib/site-meta.ts`,
     `lib/fonts.ts`, `lib/web-palette.ts`, `lib/css.ts` become shims or move.
5. **Standalone renderer.** Move `md-to-html/render.ts`'s layout wrapping into
   `application/usecases/render-standalone.ts` (full use-case extraction is
   Phase 7; here it must at least consume the model for the body). Move
   `_layouts/default.html` → `adapters/templates/default-layout.html` (Phase 8
   may defer the physical move; the reader can stay in `lib/css.ts` until then).
6. **Tests.** Add `test/adapters/render-html/html-renderer.test.ts` (model →
   HTML, using the neutral tree + assemble to build the model from the golden
   chapter) and assert the golden HTML. Update the parity test to build both
   sides from the model.

**New/changed modules.** `src/adapters/render-html/*`, `src/adapters/web/*`,
`src/build-web-book/cli.ts`; removals as above; `src/lib/*` shims.

**Keeping it green.** The **web baseline (`test/baseline/web.sha256`) is the
acceptance test**: every file byte-identical. This is the strongest guarantee in
the whole refactor and is why Phase 0 exists.

**Verification.** `just verify` green (web hashes identical), golden HTML
identical, `grep -R 'from "marked"' src` returns one path. `geek-book md` output
identical.

**Rollback.** Revert; the web build returns to `marked`'s renderer + regex.

**Risks.**

- *HTML byte fidelity* (highest). Watch: attribute order, whitespace between
  block elements, how `marked` emitted `<p>` and trailing newlines, the exact
  `<pre><code class="language-x">` shape, the code-label wrapper, heading id
  slug, and smart-typography placement.
- Mitigation: implement the renderer by **reading `marked`'s current output** on
  the golden chapter and the guide, and matching it; diff the full tree, not a
  page.
- *The back-edge removal* must not leave a circular import between
  `domain/services/code-tokenizer` and the renderer: the tokenizer is domain,
  the renderer is an adapter, so the arrow is adapter → domain, correct.

**Size.** L. **Risk.** High.

---

### Phase 6 — Lint on the model

**Goal.** Replace the linter's regex re-parsing of Markdown and its duplicated
slug logic with checks over the parsed model and a shared `AnchorIndex`; keep
style checks (whitespace, tabs, line width) on raw lines. Output must be
byte-identical.

**Preconditions.** Phase 5 merged.

**Steps.**

1. **Anchor index.** `domain/services/anchor-index.ts`: `indexAnchors(chapters)`
   and `resolveLink`, used by both the builders and lint. This is the single
   authority for "what anchors exist".
2. **Diagnostics.** `application/usecases/lint-book.ts` returns
   `Diagnostic[]` (errors + warnings + notes with stable `code`s). The CLI
   formats them through `Reporter` exactly as today (`error: file:line: msg`,
   then the summary line, then `note:` buckets).
3. **Checks over the model.** `adapters/lint/structural-checks.ts`
   (`summary`, `chapters` headings/fences/diagrams) and
   `adapters/lint/link-checks.ts` (internal links + anchors + images) read the
   `Chapter` models and the `AnchorIndex` instead of re-lexing Markdown.
   - Heading rules (one H1, first line, no skipped levels) read
     `Block[]` headings.
   - Fence balance/language/width read the raw lines *and* the model's code
     blocks; keep the raw-line pass for style so messages and columns match.
   - Link checks consume `Inline.link.target` (`internal`/`external`) and
     `ImageNode.source` (`book`/`remote`/`none`) — no `slugify` call in lint.
4. **Style checks on raw lines.** `adapters/lint/style-checks.ts` keeps the
   line-based rules (trailing whitespace, tabs, newline-at-eof, prose/table
   budgets, `text`/`ascii` width). It reuses `domain/values/text.ts` helpers.
5. **Config checks.** `adapters/lint/config-checks.ts` keeps the
   `book.schema.json` validation as-is (it is already pure and I/O-light), now
   returning `Diagnostic[]`.
6. **Delete the old linter.** Remove `src/lint/{chapter,summary,links,markdown,
   paths,errors,cli}.ts`; keep only what moved.
7. **Tests.** Snapshot: run lint on the guide and diff against
   `test/baseline/lint.txt` — identical. Add focused tests for anchor
   resolution parity (a link the builder resolves must be one lint accepts).

**New/changed modules.** `src/domain/services/anchor-index.ts`,
`src/application/usecases/lint-book.ts`, `src/adapters/lint/*` (replace
`src/lint/*`).

**Keeping it green.** `test/baseline/lint.txt` is the acceptance test. The
linter's message set and severities are frozen.

**Verification.** `just verify` green; lint output identical on the guide and the
fixtures; `just lint` exit code identical for a known-bad fixture (add one if
none exists).

**Rollback.** Revert to `src/lint/*`.

**Risks.**

- *Message drift*: line numbers, wording, ordering. Mitigation: the baseline
  diff; keep the raw-line pass so column-level checks are unchanged.
- *Anchor parity*: the linter must accept exactly the anchors the renderers
  emit. Mitigation: both now call `indexAnchors`; the `build-pdf` unresolved-ref
  check remains as an independent cross-check for the printed edition.

**Size.** M. **Risk.** Med.

---

### Phase 7 — Use cases, environment ports, composition root

**Goal.** Turn the builders into use cases returning `Result`, introduce the
environment ports (`FileSystem`, `HttpClient`, `ProcessRunner`, `PdfToolchain`,
`TemplateStore`, `ConfigSource`), move `settings` into `application`, and make
`cli/main.ts` the single composition root.

**Preconditions.** Phase 6 merged.

**Steps.**

1. **Remaining ports.** `file-system.ts`, `http-client.ts`, `process-runner.ts`,
   `pdf-toolchain.ts`, `template-store.ts`, `config-source.ts` (the shapes in
   `CLEAN_CODE_ARCHITECTURE.md` §7.1).
2. **Adapters.**
   - `adapters/fs/node-file-system.ts` (`node:fs`).
   - `adapters/http/node-http-client.ts` (global `fetch`, timeout via
     `AbortSignal`).
   - `adapters/process/node-process-runner.ts` + `system-pdf-toolchain.ts`
     (lualatex passes, `rsvg-convert`, `pdfinfo`; the `TOOL_FALLBACKS` map moves
     here).
   - `adapters/templates/asset-template-store.ts` (reads the layout, the two
     CSS files, `preamble.tex`, and the book's own `web.css`/`web.head`).
   - `adapters/config/file-config-source.ts` (reads `book.config.json` and
     `package.json`).
   - `RemoteImageStore` now takes an `HttpClient` and `FileSystem` instead of
     `fetch`/`fs` directly.
3. **Settings into the application.** Move the lenient readers to
   `adapters/config/lenient-readers.ts` (pure) and the assembly to
   `application/usecases/load-settings.ts` producing `BookSettings` +
   `Diagnostic[]`. The `BookConfig` type is replaced by `BookSettings`
   (`CLEAN_CODE_ARCHITECTURE.md` §7.3); keep a `book-config.ts` shim until
   Phase 8.
4. **Use cases.** Move orchestration out of the command modules:
   `application/usecases/{plan-book,build-website,build-pdf,render-standalone,
   serve-site,pdf-info,show-config}.ts`, each declaring the ports it needs and
   returning `Result<...>`.
   - `build-pdf` returns chapter count, page count and broken labels as data
     (the unresolved-reference check becomes a `Diagnostic[]`).
   - `serve-site` takes a `HttpServer` leaf adapter (its own small interface) and
     a `FileSystem`.
5. **Composition root.** `src/cli/main.ts` builds the `AppContext` (adapters
   wired to `BookSettings`), parses `--config`, reports load diagnostics, and
   dispatches to `cli/commands/*` (thin `(ctx, args) => Promise<Result>` wrappers
   mapped to exit codes). Delete the old `src/cli.ts`.
6. **Tests.** Add application tests driving `build-website` and `build-pdf`
   against an in-memory `FileSystem`, a fake `PdfToolchain`, fake `HttpClient`,
   fake `DiagramRenderer`. These are the first tests that exercise a whole build
   without jsdom, network or LaTeX.

**New/changed modules.** Six ports; six adapters; `application/{settings,
usecases/*}`; `src/cli/{main,commands/*}`; `src/lib/book-config/*` shims.

**Keeping it green.** Output unchanged; the use cases perform the same steps in
the same order through ports that delegate to the same implementations.

**Verification.** `just verify` green; new application tests pass;
`grep -R 'node:' src/application` empty; `grep -R 'node:child_process' src`
returns only `adapters/process/*`.

**Rollback.** Revert; command modules restore their own orchestration.

**Risks.**

- *Wiring mistakes* (a port handed the wrong context). Mitigation: the new
  application tests and `just verify`.
- *Config refactor breadth.* Mitigation: keep the `BookConfig` structural shape
  so `BookSettings` is a rename-with-narrower-fields, not a redesign; land the
  lenient readers unchanged.

**Size.** L. **Risk.** Med.

---

### Phase 8 — Collapse, assets, enforcement

**Goal.** Delete every shim, move the plain assets beside their readers, and turn
the boundary rules from *report* to *error*.

**Preconditions.** Phase 7 merged.

**Steps.**

1. **Delete shims.** Remove `src/lib/` entirely, and any leftover re-exports in
   `src/build-*`, `src/md-to-html`, `src/lint`. Fix any import that still points
   at the old paths (dependency-cruiser reports them).
2. **Move assets.**
   - `_layouts/default.html` → `adapters/templates/default-layout.html`.
   - `src/build-web-book/site.css` → `adapters/web/site.css`.
   - `src/lib/content.css` → `adapters/render-html/content.css`.
   - `src/build-tex-book/preamble.tex` → `adapters/render-tex/preamble.tex`.
   Update `asset-template-store.ts` to read them relative to itself.
   Also move the suites that follow a module: `test/diagrams/*` →
   `test/adapters/diagrams/*` (`theme.test.ts` and `render.test.ts`).
3. **Enforce.** Set every `.dependency-cruiser.cjs` rule to `severity: "error"`;
   make `just boundaries` part of `just lint`; add it to pre-commit and CI.
   Tighten `test/architecture.test.ts` to assert the final rules and the
   single-importer properties (`marked`, `jsdom`, `mermaid`, `node:*`).
4. **Docs.** Rewrite the `README.md` layout table; mark
   `CURRENT_ARCHITECTURE.md` as historical and point at the target; add a
   `CONTRIBUTING` note on the dependency rule.
5. **Clean up.** Remove now-unused `Marked` imports, the `TOOL_FALLBACKS`
   leftovers, and any dead types surfaced by `tsc`.

**New/changed modules.** Deletions across `src/lib`, `src/build-*`,
`src/md-to-html`, `src/lint`; asset moves; `.dependency-cruiser.cjs`,
`Justfile`, `.pre-commit-config.yaml`, `.github/workflows/ci.yml`, docs.

**Keeping it green.** Pure deletions and path moves; `just verify` unchanged.

**Verification.** `just boundaries` exits 0. `just verify && just lint &&
just test` green. The grad. checklist in §15 passes.

**Rollback.** Revert; shims return.

**Risks.** *Missing a shim consumer.* Mitigation: `tsc` and dependency-cruiser
both fail on a dangling import; the compiler is the safety net.

**Size.** M. **Risk.** Low.

---

## 9. The verification harness

### 9.1 Reference baseline (`just baseline` / `just verify`)

`tools/baseline/` captures the six artifacts listed in Phase 0. `just verify`
re-runs them into a scratch directory and diffs:

```text
web.sha256   ← sorted sha256 of every file under build/html/ (path-relative;
               fetched `images/remote/` excluded — upstream bytes, not our output)
book.txt     ← pdftotext -layout, whitespace-normalised
book.info    ← Pages: / Page size: from pdfinfo
lint.txt     ← geek-book lint (stdout+stderr)
config.json  ← geek-book config
md.html      ← geek-book md test/fixtures/golden/chapter.md
```

Rules:

- The website must match **exactly** (no normalisation — HTML has no
  timestamps).
- The PDF is compared **semantically** (text + page count + page size), because
  PDF metadata (`/CreationDate`, `/ID`, font subset order) is not stable. The
  canonicaliser is documented in the script.
- Lint, config and md outputs must match **exactly**.
- Baselines are generated and verified **inside `docker/Docker.book`** so
  poppler/font versions do not drift. A local `just verify` outside the image
  compares HTML/lint/config/md and warns that the PDF was not compared.

### 9.2 Why the PDF is semantic, not byte-wise

Two builds of the same LaTeX produce different bytes (timestamps, object order,
font subsetting). Text extraction plus page count plus page size is the stable
projection that still catches real regressions (a page appearing, a heading
moving, a figure vanishing). `test/fixtures/golden/chapter.tex` stays the
byte-exact guard for the *LaTeX text*, which is where the serializer's fidelity
lives.

### 9.3 Boundary fitness (`just boundaries`)

`dependency-cruiser` with the rules of `CLEAN_CODE_ARCHITECTURE.md` §13. Report
mode in Phase 0; error mode in Phase 8. `test/architecture.test.ts` asserts the
same rules programmatically so a violation fails the unit suite too.

### 9.4 The golden fixtures

`test/fixtures/golden/chapter.{md,html,tex}` remain the per-construct guard.
Phase 3 (TeX) and Phase 5 (HTML) must reproduce them byte-for-byte. Extend the
fixture's *Markdown* only if a construct the engine already supports is missing
from it, and regenerate the HTML/TeX goldens only when that construct's output is
understood and unchanged.

`test/fixtures/golden/diagram.md` (added **before** Phase 0, see §11) is the
diagram counterpart. It is not wired into the sync `chapter.*` round-trip — that
fixture's HTML is produced by `renderBody`, which does not preprocess Mermaid, so
a fence there would golden a plain code block rather than the SVG the site emits.
The diagram is instead guarded by `test/diagrams/render.test.ts`, an isolated
**structural** suite: it asserts an `<svg>` with a recomputed viewBox, labels
rewritten to native `<text>`, and one sized `Figure`, rather than the SVG bytes.
This keeps the only jsdom/Mermaid boot in a file of its own (the risk register's
"isolate its one integration test") and stays robust to a Mermaid upgrade, which
must read as a version change and not a broken golden. Byte-exactness for the
real diagram comes from `just verify` over the guide's own diagram chapter; the
suite is not regenerated and never becomes a golden.

---

## 10. Risk register

| Risk | Phase | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| HTML byte drift after the renderer swap | 5 | High | High | Full-tree hash baseline; implement by matching observed `marked` output; diff every file |
| `marked` token fidelity (`escaped`, entities, breaks, tables) | 3 | Med | High | Golden TeX + parse tests; extend fixture only for supported constructs |
| Smart-typography id/punctuation drift | 3, 6 | Med | Med | Parity test + lint anchor test; single shared implementation |
| PDF nondeterminism masking or faking a diff | 0, 4 | Med | Med | Semantic comparison (text + pages + size) in the pinned image; TeX golden byte-exact |
| Lint message/line drift | 6 | Med | Med | `lint.txt` baseline; keep the raw-line style pass |
| Branded-path adoption balloons | 2 | Med | Med | Split branding into a focused follow-up; land the model first |
| `verbatimModuleSyntax` type-only churn | 2–7 | Med | Low | Use `import type`; keep `export type` in shims |
| jsdom global mutation leaking across tests | 3, 4 | Low | Med | Isolated in `test/diagrams/render.test.ts` (added before Phase 0); keep the Mermaid renderer behind the port |
| Diagram suite brittle to a Mermaid upgrade | 3, 4 | Med | Low | Assert structure (viewBox, `<text>` labels, one sized `Figure`), never the SVG bytes; byte-exactness stays with `just verify` over the guide |
| Two code paths alive during strangler | 3–7 | Med | Med | Each phase flips one consumer and deletes the old path or shims it; no path lives more than one phase |
| Large PRs / review fatigue | all | Med | Med | One phase per PR; shims keep diffs local; verify gates the merge |
| Wiring a port to the wrong context | 7 | Low | Med | New application tests with fakes; verify |
| Toolchain version drift between dev and CI | 0, 4 | Med | Low | Baselines captured in Docker; local verify skips the PDF |

---

## 11. Testing additions, by phase

| Phase | Added tests |
| --- | --- |
| pre‑P0 | `test/diagrams/render.test.ts` + `test/fixtures/golden/diagram.md` — the isolated, structural jsdom/Mermaid integration guard (see §9.4); added before the baseline so it runs throughout the refactor |
| 0 | `test/architecture.test.ts` (report mode); baseline harness |
| 1 | `test/domain/diagnostics.test.ts`; `test/adapters/reporting/{console-reporter,console-logger}.test.ts` |
| 2 | `test/domain/{anchor,placeholders,code-language,smart-typography,geometry}.test.ts` |
| 3 | `test/adapters/markdown/marked-parser.test.ts`; `test/domain/assemble.test.ts` |
| 4 | `test/application/source-to-model.test.ts` (fake ports) |
| 5 | `test/adapters/render-html/html-renderer.test.ts`; parity test rebuilt on the model |
| 6 | `test/application/lint-book.test.ts`; anchor-parity test |
| 7 | `test/application/{build-website,build-pdf}.test.ts` (in-memory fs, fake toolchain) |
| 8 | tightened `test/architecture.test.ts` (error mode) |

Existing suites (`test/lib`, `test/build-tex-book`, `test/md-to-html`,
`test/diagrams`, `test/parity`) are kept green throughout and moved/renamed only
when their module moves. The `test/diagrams/*` suites follow `src/diagrams/` into
`test/adapters/diagrams/` in Phase 8, when the assets and modules move.

---

## 12. Rollback

- **Per phase.** Every phase is a single PR whose net effect is either additive
  or a shimmed move, so `git revert` restores the previous state in one step.
- **Within a phase.** Work is committed in small steps; the failing check at any
  point identifies the regression, and `just verify` names the changed artifact.
- **The baseline is the contract.** No phase is merged with a baseline diff.
  If a phase cannot achieve byte-identity, it is not the target architecture yet;
  the discrepancy is a bug to fix, not a baseline to update.
- **Nuclear option.** The refactor touches only `src/` structure and a few
  tooling files; `bin/geek-book.mjs`, `book.config.json` and the guide are
  untouched, so the pre-refactor engine is always recoverable from `main`.

---

## 13. Conventions for new code

- **Folders are layers.** `domain/`, `application/`, `adapters/`, `cli/`.
- **File names** are kebab-case; imports carry the `.js` extension (NodeNext).
- **Ports** live in `application/ports/`, named for the capability
  (`FileSystem`, `ImageStore`). **Adapters** live in `adapters/<technology>/`,
  named for the technology (`NodeFileSystem`, `MarkedParser`,
  `MermaidDiagramRenderer`).
- **`domain/` imports** only from `domain/`. No `node:*`, no third-party, no
  `process`, no `console`.
- **`application/` imports** only from `application/` and `domain/`. Use cases
  return `Result<T>`; they never write to a stream or pick an exit code.
- **`adapters/`** may import `domain/`, `application/`, `node:*` and
  third-party. An adapter may throw; the use case converts a throw into a
  `Diagnostic`.
- **`cli/`** is the only place that composes adapters and the only place that
  maps results to exit codes.
- **Assets** sit beside the adapter that reads them.
- **Types** for boundaries are branded (`BookPath`, `OutputPath`, `Anchor`).
- **No new dependency** may be imported outside `adapters/`/`cli/`; a check in
  Phase 8 enforces it.

---

## 14. PR checklist (paste into every phase PR)

```text
Phase: N — <name>

[ ] just verify            (baseline identical: web / pdf / lint / config / md)
[ ] just lint              (tsc + engine + guide checks)
[ ] just test              (vitest)
[ ] just html && just pdf  (both editions build)
[ ] just boundaries        (no NEW violation introduced)
[ ] No `just baseline` regeneration (unless phase is an explicit behaviour change)
[ ] grep -R 'from "marked"' src  → expected importer set for this phase
[ ] grep -R 'node:' src/domain src/application  → empty once Phases ≥ 5 land
[ ] New tests added per §11
[ ] Shims introduced/removed noted in the description
[ ] Rollback noted (revert / restore old path)
```

---

## 15. End-state checklist (graduation)

Run on a clean checkout of the final commit:

```text
[ ] depcruise src exits 0 with all rules at "error"
[ ] grep -R 'from "marked"' src                → 1 path
[ ] grep -R 'from "jsdom"\|from "mermaid"' src → adapters/diagrams only
[ ] grep -R 'node:' src/domain src/application → empty
[ ] src/lib, src/build-web-book, src/build-tex-book, src/diagrams,
    src/md-to-html, src/lint  → all gone
[ ] just verify  → web sha256, book text/pages/size, lint, config, md identical
[ ] just test    → green (domain, application-fakes, adapters, parity, golden)
[ ] just docker-book → the guide builds in the pinned image
[ ] README + architecture docs describe the new layout
[ ] CI runs just boundaries (failing) and just verify (failing)
```

When this list passes, the engine matches `CLEAN_CODE_ARCHITECTURE.md` and the
plan is done.

---

## Appendix A — Current import graph (the thing being fixed)

Condensed from the current tree; full detail in `CURRENT_ARCHITECTURE.md`.

```text
importers of "marked":   build-tex-book/blocks.ts · build-tex-book/images.ts ·
                         build-tex-book/inlines.ts · lib/markdown.ts ·
                         lib/remote-images.ts · lib/smart-typography.ts
importers of "node:fs":  20 files across lib/, build-*, lint/, md-to-html/,
                         pdf-info/, serve/, cli.ts
importers of "mermaid":  diagrams/theme.ts
importers of "jsdom":    diagrams/shims.ts
importers of "node:http": serve/cli.ts
importers of
  "node:child_process":  build-tex-book/cli.ts · pdf-info/cli.ts · pdf-info/pdf.ts

known back-edge:  lib/markdown.ts ⇄ md-to-html/render.ts (highlightComments)
```

Target (Phase 8): `marked` → 1 path; `jsdom`/`mermaid` → `adapters/diagrams/*`;
`node:*` → `adapters/**` and `cli/**`; no edge out of `domain/`.

---

## Appendix B — Phase → files (quick index)

| Phase | Primary files created | Primary files changed/removed |
| --- | --- | --- |
| 0 | `tools/baseline/*`, `.dependency-cruiser.cjs`, `test/architecture.test.ts`, `test/baseline/*` | `Justfile`, `package.json`, CI |
| 1 | `domain/diagnostics.ts`, `application/ports/{reporter,logger}.ts`, `adapters/reporting/{console-reporter,console-logger}.ts` | `src/cli.ts` |
| 2 | `domain/model/*`, `domain/values/*` | `lib/{summary,markdown,smart-typography,code-meta,langs,content-placeholders,ui-strings}.ts`, `lib/book-config/types.ts`, `build-tex-book/ir.ts` → shims |
| 3 | `application/ports/markdown-parser.ts`, `adapters/markdown/marked-parser.ts`, `domain/services/{assemble,resolve-links,resolve-images}.ts`, `domain/values/entities.ts` | `build-tex-book/parse.ts`; delete `build-tex-book/{blocks,inlines,entities,links,images,state}.ts` |
| 4 | `application/ports/{diagram-renderer,image-store,image-measurer}.ts`, `adapters/diagrams/mermaid-renderer.ts`, `adapters/http/remote-image-store.ts`, `adapters/images/image-measurer.ts`, `application/pipelines/source-to-model.ts` | `build-tex-book/{parse,cli}.ts`, `build-web-book/cli.ts`, `diagrams/render.ts` (extract diagrams) |
| 5 | `adapters/render-html/*`, `adapters/web/*`, `application/usecases/render-standalone.ts` | `build-web-book/cli.ts`; delete `build-web-book/{page,nav,links,site}.ts`; `lib/markdown.ts` hooks removed |
| 6 | `domain/services/anchor-index.ts`, `application/usecases/lint-book.ts`, `adapters/lint/*` | delete `src/lint/{chapter,summary,links,markdown,paths,errors,cli}.ts` |
| 7 | `application/ports/{file-system,http-client,process-runner,pdf-toolchain,template-store,config-source}.ts`, `adapters/{fs,http,process,templates,config}/*`, `application/{settings,usecases/*}`, `src/cli/{main,commands/*}` | delete `src/cli.ts`; `lib/book-config/*` → shims |
| 8 | (moves) assets into `adapters/**`; `test/diagrams/*` → `test/adapters/diagrams/*` | delete all shims and `src/lib`, `src/build-*`, `src/md-to-html`, `src/lint`, `src/diagrams`; `.dependency-cruiser.cjs` → error |

---

## Appendix C — Glossary

| Term | Meaning here |
| --- | --- |
| **Domain** | The pure core: the book model, value objects and domain services. Imports nothing outside itself. |
| **Application** | Use cases and the ports they need. Pure-but-async; no technology. |
| **Adapter** | A concrete implementation of a port bound to a technology (`marked`, `node:fs`, `lualatex`). |
| **Port** | An interface declared by the layer that needs it and implemented by an adapter. |
| **Use case** | One application operation (`build-website`, `lint-book`) orchestrating ports and the domain, returning `Result`. |
| **Neutral tree** | The parser-independent Markdown AST (`MdNode`/`MdInline`) between the `marked` adapter and the domain walk. |
| **Strangler** | Migrating by leaving re-export shims at old paths so importers keep working while code moves underneath. |
| **Baseline / golden** | Frozen output used as the acceptance test. `just verify` for the editions; `test/fixtures/golden/*` for individual pipelines. |
| **Fitness function** | An automated check of an architectural property (here, `dependency-cruiser` rules and `test/architecture.test.ts`). |
