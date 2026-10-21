# Inside the engine

*The four layers, the one dependency rule, and where new code goes.*

The engine is a TypeScript program in four layers. Each layer may depend on the
one inside it and on nothing further out, which is what keeps the website and
the printed page from drifting apart.

```text
src/
  domain/       the document model, values and services — pure
  application/  ports, use cases, pipelines and settings
  adapters/     Markdown, diagrams, HTML, LaTeX, files, network, process
  cli/          main.ts, the composition root
```

## One model, two renderers

The build has a single spine. `source-to-model` turns a chapter's Markdown into
one `Chapter` tree for both editions: it substitutes diagrams, collects remote
images, parses with the `MarkdownParser` port, draws the diagrams, and assembles
the headings, blocks and anchors. From there `adapters/render-html/` writes the
page and `adapters/render-tex/` writes the LaTeX — two renderers over one model,
not two pipelines that must be kept in step.

## Ports and adapters

Anything that touches the outside world sits behind a port: the filesystem, the
HTTP client, the process runner, the PDF toolchain, the template store, the
config source, the Markdown parser, the diagram renderer, the image store, the
reporters, and the preview server. `application/` defines the
interfaces, `adapters/` implements them, and `cli/context.ts` chooses the real
ones while `cli/main.ts` wires them into commands.

Because of that, a use case can run against an in-memory filesystem and a fake
toolchain, and the domain never sees a package or a `node:` import.

## The dependency rule

```text
cli  →  adapters  →  application  →  domain
```

`src/domain/` imports nothing outside itself. `src/application/` may use the
domain and its own ports, never an adapter or the CLI. Adapters never import the
composition root. The rule is enforced twice: `.dependency-cruiser.cjs` runs as
part of `just lint`, and `test/architecture.test.ts` asserts the same graph in
the unit suite. `marked`, `jsdom` and `mermaid` are each allowed from one
adapter directory only.

## The safety net

`just test` runs the unit suite. `just verify` rebuilds both editions and diffs
six artifacts against `test/baseline/`: the website's checksums, the PDF's
extracted text and page facts, the linter's output, the resolved config and one
standalone page. A diff is a bug unless the change was meant to move the output
— a new chapter or a new version is; a refactor is not. Diagnostic text, exit
codes, config keys and CLI flags belong to the same contract.

## Where new code goes

| You are adding… | It goes in |
| --- | --- |
| a pure rule, such as a slug or a tokenizer | `src/domain/values/` or `src/domain/services/` |
| a command's work | `src/application/usecases/` |
| something a use case needs from outside | a port in `src/application/ports/`, implemented in `src/adapters/` |
| a config key | `src/application/settings.ts`, `settings/readers.ts` and `book.schema.json` |
| a file format or an external tool | one adapter, plus a boundary rule if more will follow |

The repository's `CONTRIBUTING.md` repeats the two rules a change must respect —
dependencies point inward, and output is the contract — and lists the checks to
run before a commit.
