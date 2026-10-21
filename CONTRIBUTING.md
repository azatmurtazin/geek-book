# Contributing

The engine builds a book from Markdown into two editions — a static website and
a print-ready PDF — and the two must not drift. The architecture is what keeps
them from drifting: one model, one walk, one set of values, and the environment
pushed to the edge. The guide tells the same story in
[Inside the engine](./book/chapters/05_engine/00_index.md). Two rules matter
more than style:

## 1. Dependencies point inward

```text
cli  →  adapters  →  application  →  domain
```

- **`src/domain/`** is the pure core: the document model, the values (slugs,
  fonts, palettes, geometry) and the services that assemble and resolve it. It
  imports nothing outside `domain/` — no `node:` builtins, no third-party
  packages, no outer layer.
- **`src/application/`** holds ports, use cases, pipelines and settings. It may
  import `application/` and `domain/` only. Reaching for an adapter, the CLI or
  `node:fs` means the thing you need belongs behind a new port.
- **`src/adapters/`** implement the ports: `marked`, `mermaid`/jsdom, the
  filesystem, the network, LuaLaTeX, the linter's checks. They never import
  `cli/`.
- **`src/cli/`** is the composition root (`main.ts` parses the line,
  `context.ts` builds the adapters). Commands stay thin: parse arguments, call a
  use case, choose the streams and the exit code.

The rules are enforced, not suggested: `.dependency-cruiser.cjs` runs as part of
`just lint` (`just boundaries` alone), and `test/architecture.test.ts` asserts
the same graph in the unit suite. `marked`, `jsdom` and `mermaid` are allowed
only from the adapter directory that owns them.

## 2. Output is the contract

The built book is frozen: `test/baseline/` holds the website's checksums, the
PDF's extracted text and page facts, the linter's output, the resolved config
and one standalone page. `just verify` rebuilds and diffs them.

- A diff is a bug unless the change was meant to move the output (a new
  chapter, a new version). Fix the code, not the baseline; refresh the baseline
  only for a change that was supposed to alter what the book says.
- Add a test before changing a renderer. The golden fixtures
  (`test/fixtures/golden/`) guard the LaTeX and HTML per construct; the baseline
  guards the whole guide.
- Diagnostic text, exit codes, config keys and CLI flags are part of the
  contract too.

## Where things go

| You are adding…                | It goes in                                            |
| ------------------------------ | ----------------------------------------------------- |
| a pure rule (slug, tokenizer)  | `src/domain/values/` or `src/domain/services/`        |
| a use case (a command's work)  | `src/application/usecases/`                           |
| a capability the use case needs| a port in `src/application/ports/`, implemented in `src/adapters/` |
| a config key                   | `src/application/settings.ts` + `settings/readers.ts` + `book.schema.json` |
| a third-party dependency       | one adapter file, and a `-only-in-its-adapter` rule if more will follow |
| a plain asset (CSS, LaTeX, layout) | beside the adapter that reads it                  |

## Before you commit

```sh
just lint     # tsc, the guide's own lint, and the boundary rules
just test
just verify   # rebuilds the guide and diffs the baseline (use Docker for the PDF)
```

The pre-commit hook runs the same checks and builds both editions.
