# Clean Code Architecture — proposed target

> This is a **proposal**, not a description of the code today. For the current
> shape see [`CURRENT_ARCHITECTURE.md`](./CURRENT_ARCHITECTURE.md). This document
> defines an ideal arrangement of the same engine — one that keeps every
> behaviour, every config key and every output byte-for-byte compatible, while
> making the dependencies point in one direction and the domain independent of
> `marked`, jsdom, the filesystem, the network and LuaLaTeX.
>
> It is deliberately opinionated. Section 17 lists what it deliberately does
> **not** do, so the ambition stays honest.

---

## 1. Why, in one paragraph

`geek-book` already pursues the right goal — one source of truth per fact, two
editions that cannot drift — but it enforces that goal with convention and tests
rather than with structure. `marked` is imported by six modules across three
layers; `node:fs` by twenty; the website renderer emits HTML straight from the
parser's hooks while the print renderer builds a separate tree; the linter
re-parses Markdown with its own regexes and re-derives the same heading slugs a
third time. Every one of these is a place where the two editions, or the linter
and the builders, can silently disagree. A clean architecture makes the shared
model the *only* path and the environment the *outermost* ring, so parity is a
property of the types instead of a test that must keep passing.

---

## 2. The principles

These are the rules the target layout is built to satisfy. Where a rule is
enforced by tooling it is marked **[auto]** (see §13).

1. **The dependency rule.** Source dependencies point inward and only inward:
   `cli → adapters → application → domain`. Nothing in `domain` knows anything
   outside `domain`.
2. **Functional core, imperative shell.** The domain and the application layer
   are pure (or pure-but-async); all I/O, time, randomness, processes and the
   network live in the shell (`adapters` + `cli`).
3. **One document model, N renderers.** Markdown is an *input format*; HTML and
   LaTeX are *output formats*. Both consume the same `Book`/`Chapter` model. A
   third edition (EPUB, man page) would add a renderer, not a pipeline.
4. **Ports live with their caller.** An interface is declared in the layer that
   needs it (`application`), and implemented in the layer that can satisfy it
   (`adapters`). The domain declares no ports — it needs nothing.
5. **Ports and adapters are explicit at the edge.** `fs`, `http`, `child_process`,
   `marked`, `jsdom`, `mermaid` appear in `adapters`/`cli` only. **[auto]**
6. **Represent boundaries in the type system.** Paths that mean different things
   (`BookPath`, `OutputPath`, `SourcePath`) are distinct types, so the compiler
   catches the mix-ups the current `string`-everywhere code cannot.
7. **Failures are values.** A use case returns a `Result` with `Diagnostic`s; it
   does not `console.log`, does not write to `stderr`, and does not choose an
   exit code. The CLI maps results to exit codes and renders diagnostics.
8. **Configuration is a validated domain object.** Reading JSON is an adapter;
   interpreting it is a pure function with diagnostics. The engine stays lenient
   (bad value → default + warning), exactly as today.
9. **Assets live beside the adapter that reads them.** `site.css`,
   `content.css`, `preamble.tex`, `_layouts/default.html` sit in the adapter
   directory that loads them, addressed through a `TemplateStore` port.
10. **Behaviour is preserved.** No config key, CLI flag, output path, message or
    exit code changes. This is a refactor of internals.

---

## 3. The dependency rule, visualised

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ cli/                         composition root · commands · static server  │
│   main.ts  commands/*  serve/*                                            │
├───────────────────────────────────────────────────────────────────────────┤
│ adapters/                    marked · mermaid+jsdom · fs · http · process │
│   markdown/ diagrams/ render-html/ render-tex/ config/ fs/ http/ process/ │
│   web/ pdf/ lint/ reporting/ templates/                                   │
├───────────────────────────────────────────────────────────────────────────┤
│ application/                 use cases + ports                            │
│   usecases/  ports/  pipelines/                                           │
├───────────────────────────────────────────────────────────────────────────┤
│ domain/                      the book itself — pure, dependency-free      │
│   model/  values/  services/  diagnostics.ts                              │
└───────────────────────────────────────────────────────────────────────────┘

  allowed imports:  cli → {adapters, application, domain}
                    adapters → {application, domain, node_modules, node:*}
                    application → {domain}
                    domain → {domain}
```

The whole point is the bottom row: **`domain` has no import that leaves
`domain`.** It cannot reach `marked`, cannot read a file, cannot spawn a process,
cannot fetch a URL. If it needs any of those, that need is a port declared one
layer up and injected.

---

## 4. Target directory layout

```code
src/
├── domain/                         # pure core; imports only from domain/
│   ├── model/
│   │   ├── book.ts                 # Book, BookMetadata
│   │   ├── chapter.ts              # Chapter, Block, TableRow, Align
│   │   ├── inline.ts               # Inline, LinkTarget, ImageNode, ImageSource
│   │   ├── assets.ts               # Figure, ImageAsset, FileName
│   │   └── toc.ts                  # Toc, TocEntry, TocGroup
│   ├── values/
│   │   ├── paths.ts                # BookPath, OutputPath, SourcePath (branded)
│   │   ├── anchor.ts               # Anchor (branded), slugify, anchor rules
│   │   ├── geometry.ts             # PaperName, Geometry, pxToMm, PAPERS
│   │   ├── palette.ts              # Palette, ColorKey
│   │   ├── typography.ts           # TypeScale, heading leading
│   │   ├── smart-typography.ts     # the quote/dash walk
│   │   ├── placeholders.ts         # PlaceholderMap + substitution rules
│   │   ├── code-language.ts        # CodeLanguage, comment style, labels, table
│   │   ├── fonts.ts                # FontFamilies (names), diagram family
│   │   └── ui-strings.ts           # UiStrings + defaults
│   ├── services/
│   │   ├── assemble.ts             # neutral Markdown tree → Block[] (the walk)
│   │   ├── anchor-index.ts         # AnchorIndex; assignment + lookup
│   │   ├── resolve-links.ts        # href → LinkTarget (the one resolver)
│   │   ├── resolve-images.ts       # src → ImageSource (the one resolver)
│   │   └── code-tokenizer.ts       # code ⇄ comment runs (shared by renderers)
│   └── diagnostics.ts              # Diagnostic, Severity, Result, ok/fail
│
├── application/
│   ├── ports/
│   │   ├── markdown-parser.ts      # MarkdownParser → neutral tree
│   │   ├── diagram-renderer.ts     # DiagramRenderer → Figure
│   │   ├── image-store.ts          # ImageStore (remote fetch + naming)
│   │   ├── image-measurer.ts       # ImageMeasurer (bytes → pixel size)
│   │   ├── file-system.ts          # FileSystem (the thin fs seam)
│   │   ├── template-store.ts       # TemplateStore (layout, css, tex preamble)
│   │   ├── http-client.ts          # HttpClient
│   │   ├── process-runner.ts       # ProcessRunner
│   │   ├── pdf-toolchain.ts        # PdfToolchain (compile, svgToPdf, pageCount)
│   │   ├── config-source.ts        # ConfigSource (raw JSON in)
│   │   ├── reporter.ts             # Reporter (diagnostics out)
│   │   └── logger.ts               # Logger (progress lines only)
│   ├── pipelines/
│   │   └── source-to-model.ts      # placeholder → smart → diagrams → model
│   ├── settings.ts                 # BookSettings (the validated config shape)
│   └── usecases/
│       ├── load-settings.ts
│       ├── plan-book.ts
│       ├── parse-chapter.ts
│       ├── build-website.ts
│       ├── build-pdf.ts
│       ├── lint-book.ts
│       ├── render-standalone.ts
│       ├── serve-site.ts
│       ├── pdf-info.ts
│       └── show-config.ts
│
├── adapters/
│   ├── markdown/marked-parser.ts   # the ONLY importer of `marked`
│   ├── diagrams/
│   │   ├── mermaid-renderer.ts     # the ONLY importer of `mermaid`
│   │   ├── jsdom-shims.ts          # the ONLY importer of `jsdom`
│   │   ├── mermaid-theme.ts
│   │   └── svg-fixup.ts
│   ├── render-html/
│   │   ├── html-renderer.ts        # Chapter → HtmlFragment
│   │   ├── html-inline.ts
│   │   ├── escape.ts
│   │   ├── site-meta.ts
│   │   ├── stylesheets.ts          # font vars + palette vars → CSS
│   │   └── content.css             # shared markup rules (was lib/content.css)
│   ├── render-tex/
│   │   ├── tex-renderer.ts         # Chapter → LaTeX
│   │   ├── tex-escape.ts
│   │   ├── tex-figures.ts
│   │   ├── front-matter.ts
│   │   ├── preamble-loader.ts
│   │   └── preamble.tex
│   ├── config/
│   │   ├── file-config-source.ts   # ConfigSource over a file
│   │   └── lenient-readers.ts      # raw JSON → BookSettings (pure)
│   ├── fs/node-file-system.ts
│   ├── http/{node-http-client.ts, remote-image-store.ts}
│   ├── process/{node-process-runner.ts, system-pdf-toolchain.ts}
│   ├── web/
│   │   ├── website-writer.ts       # pages + assets to disk
│   │   ├── page-shell.ts           # the document template + head script
│   │   ├── navigation.ts           # sidebar + footer
│   │   └── site.css
│   ├── pdf/document-writer.ts      # book.tex + figures to disk
│   ├── lint/
│   │   ├── structural-checks.ts    # over the model
│   │   ├── style-checks.ts         # over raw lines
│   │   ├── link-checks.ts          # over the model + AnchorIndex
│   │   └── config-checks.ts        # over RawConfig + schema
│   ├── reporting/console-reporter.ts
│   └── templates/asset-template-store.ts
│
├── cli/
│   ├── main.ts                     # composition root
│   ├── commands/{web,pdf,serve,lint,md,pdf-info,config}.ts
│   └── serve/static-server.ts
│
├── book.schema.json
└── jsdom-shim.d.ts                # stays beside the adapter that needs it
```

The mapping from today's files is in §14. Note what changed shape:

- `lib/` **dissolves** — its pure parts become `domain/`, its I/O parts become
  `adapters/`. The neutral name hid a dependency problem; splitting it by purity
  makes the problem visible and checked.
- `build-web-book/` and `build-tex-book/` stop being siblings of `lib/`. Their
  shared, pure parts are `domain/`; their output-specific parts are two renderer
  *adapters*; their orchestration is one `build-website` / `build-pdf` *use case*.

---

## 5. The domain model

The keystone idea: **promote the print builder's IR to the whole engine's
document model.** Today the print path already owns a good, LaTeX-free tree
(`build-tex-book/ir.ts`); the print path is the one that got the architecture
right. The website path, by contrast, lets `marked` emit HTML directly and then
patches the HTML string. The target makes the IR the single model and turns both
editions into renderers of it.

### 5.1 Book and chapter

```ts
// domain/model/book.ts
export interface Book {
  readonly settings: BookSettings;
  readonly metadata: BookMetadata;      // title, tagline, author, version, language, strings
  readonly toc: Toc;
  readonly chapters: readonly Chapter[]; // written chapters, in reading order
}

// domain/model/toc.ts
export type Toc = readonly TocItem[];
export type TocItem =
  | { kind: "group"; title: string; line: number }
  | { kind: "entry"; label: string; path: BookPath; indent: number; line: number };
```

```ts
// domain/model/chapter.ts
import type { Anchor } from "../values/anchor.js";
import type { BookPath } from "../values/paths.js";
import type { FileName } from "../model/assets.js";

export type ChapterId = number;               // 0, 1, 2 … from SUMMARY

export interface Chapter {
  readonly id: ChapterId;
  readonly path: BookPath;                    // relative to the book directory
  readonly label: string;                     // the SUMMARY label (running head, nav)
  readonly blocks: readonly Block[];
  readonly anchors: AnchorIndex;              // every anchor this chapter defines
  readonly figures: readonly Figure[];        // diagrams the build must write out
  readonly images: readonly ImageAsset[];     // book files the build must copy
}

export type Block =
  | { kind: "heading"; depth: HeadingDepth; text: readonly Inline[]; anchors: readonly Anchor[] }
  | { kind: "paragraph"; content: readonly Inline[] }
  | { kind: "code"; lang: CodeLanguage; code: string }
  | { kind: "callout"; blocks: readonly Block[] }
  | { kind: "list"; ordered: boolean; start: number; items: readonly (readonly Block[])[] }
  | { kind: "table"; align: readonly Align[]; header: TableRow; rows: readonly TableRow[] }
  | { kind: "figure"; figure: Figure }        // a rendered Mermaid fence
  | { kind: "image"; image: ImageNode }       // a standalone picture
  | { kind: "rule" };

export type TableRow = readonly (readonly Inline[])[];
export type Align = "left" | "center" | "right" | null;
export type HeadingDepth = 1 | 2 | 3 | 4 | 5 | 6;
```

### 5.2 Inline content and resolved targets

The difference from today: a link is not an `href` string plus a resolved
`target` field — it is a **sum type** that has already been classified, and an
image carries a **resolved source**, not a `src` string that each renderer
re-derives.

```ts
// domain/model/inline.ts
export type Inline =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "strong"; content: readonly Inline[] }
  | { kind: "em"; content: readonly Inline[] }
  | { kind: "del"; content: readonly Inline[] }
  | { kind: "break" }
  | { kind: "link"; target: LinkTarget; content: readonly Inline[] }
  | { kind: "image"; image: ImageNode };

/** Where a link points, already decided by the one resolver. */
export type LinkTarget =
  | { kind: "internal"; anchor: Anchor }        // names a heading in this book
  | { kind: "external"; href: string };         // an outside URL

export interface ImageNode {
  readonly alt: string;
  readonly source: ImageSource;
}

/** Where a picture's file is, already decided by the one resolver. */
export type ImageSource =
  | { kind: "book"; path: BookPath; copy: FileName }   // copied into the output
  | { kind: "remote"; url: string; file: FileName }    // fetched into the output
  | { kind: "none" };                                  // nothing to place: alt text
```

Both renderers, and the linter, now read the *same* classified links and sources
instead of each re-implementing `resolveImagePath`, `linkTarget` and `rewrite*`.

### 5.3 Assets

```ts
// domain/model/assets.ts
export type FileName = string & { readonly __brand: "FileName" }; // LaTeX/output-safe name

export interface Figure {
  readonly name: FileName;                     // e.g. c3-d0.pdf
  readonly svg: string;
  readonly size: PixelSize | null;             // from the SVG viewBox, else null
}
export interface ImageAsset {
  readonly path: BookPath;                     // source, relative to the book dir
  readonly name: FileName;                     // copy under the build's figures/
}
export interface PixelSize { readonly width: number; readonly height: number; }
```

---

## 6. Domain values and services

### 6.1 Boundaries as types

The single most valuable new type discipline: today `relBook`, `outputRel`,
`sourcePath`, `rel`, `href` are all `string`, and the code relies on comments to
keep them apart. In the target they are distinct branded types:

```ts
// domain/values/paths.ts
export type BookPath   = string & { readonly __brand: "BookPath" };   // relative to book/
export type OutputPath = string & { readonly __brand: "OutputPath" }; // relative to output dir
export type SourcePath = string & { readonly __brand: "SourcePath" }; // relative to book root
export type Anchor     = string & { readonly __brand: "Anchor" };     // c3, c3--a-slug

export const bookPath   = (s: string): BookPath   => s as BookPath;
export const outputPath = (s: string): OutputPath => s as OutputPath;
export const anchor     = (s: string): Anchor     => s as Anchor;
```

A branded type is zero-cost at runtime and catches, at compile time, the class of
bug the current string-based code can only catch with a test (if at all).

### 6.2 The anchor backbone

Anchors are how the two editions and the linter agree. Today the rule lives in
three places: `lib/markdown.ts` (`slugify`), `build-tex-book/blocks.ts`
(`c<id>--slug`), and `lint/links.ts` (raw-heading slugging). In the target it
lives in one module, used by the walk and the linter alike:

```ts
// domain/values/anchor.ts
export function slugify(text: string): string;            // the one slug rule
export function chapterAnchor(id: ChapterId): Anchor;     // "c3"
export function headingAnchor(id: ChapterId, slug: string): Anchor; // "c3--a-slug"
```

```ts
// domain/services/anchor-index.ts
export interface AnchorIndex {
  readonly byAnchor: ReadonlyMap<Anchor, { chapter: ChapterId; depth: HeadingDepth }>;
}
export function indexAnchors(chapters: readonly Chapter[]): AnchorIndex;

/** The one link resolver, used by the walk and by lint. */
export function resolveLink(
  href: string,
  from: { chapter: ChapterId; path: BookPath },
  chapters: ReadonlyMap<BookPath, ChapterId>,
): LinkTarget;
```

### 6.3 Smart typography

Unchanged in behaviour, moved to `domain/values/smart-typography.ts`. The token
walk and the raw-string form stay, because `marked`'s hook and the print walk
both need them — but the walk now operates on the **neutral tree** (§7.1), so it
no longer imports `marked` types.

### 6.4 Code tokenization

`domain/services/code-tokenizer.ts` keeps today's `tokenizeCode` exactly. It is
pure and read by both renderers, which is the point: comment runs are computed
once.

### 6.5 The walk

The print builder's `blocks.ts` + `inlines.ts` become
`domain/services/assemble.ts`, one module that turns the neutral Markdown tree
into `Block[]` and `Inline[]`. It is pure, has no I/O, and is the *only* place a
construct's meaning is decided. Adding a construct means touching this file and
the two renderers — nowhere else.

---

## 7. The application layer

### 7.1 Ports

Ports are minimal and shaped for the caller. Importing `Buffer` in a domain-port
signature is avoided by making the HTTP port return `Uint8Array`.

```ts
// application/ports/markdown-parser.ts
/** A neutral Markdown tree: no parser types, no domain meaning. */
export interface MarkdownParser {
  lex(source: string): readonly MdNode[];
}
export type MdNode =
  | { type: "heading"; depth: number; inline: readonly MdInline[] }
  | { type: "paragraph"; inline: readonly MdInline[] }
  | { type: "code"; lang: string; text: string }
  | { type: "blockquote"; children: readonly MdNode[] }
  | { type: "list"; ordered: boolean; start: number; items: readonly (readonly MdNode[])[] }
  | { type: "table"; align: readonly Align[]; header: readonly (readonly MdInline[])[]; rows: readonly (readonly (readonly MdInline[])[])[] }
  | { type: "rule" }
  | { type: "html"; text: string };
export type MdInline =
  | { type: "text"; text: string }
  | { type: "code"; text: string }
  | { type: "strong" | "em" | "del"; children: readonly MdInline[] }
  | { type: "break" }
  | { type: "link"; href: string; children: readonly MdInline[] }
  | { type: "image"; href: string; alt: string }
  | { type: "html"; text: string };
```

```ts
// application/ports/diagram-renderer.ts
export interface DiagramRenderer {
  render(source: string, id: string): Promise<Figure>;
}

// application/ports/image-store.ts
export interface ImageStore {
  /** Fetch every remote image a chapter references; keyed by URL. */
  collect(markdown: string): Promise<void>;
  /** The stored copy of a URL, after collect(), or null. */
  lookup(url: string): StoredImage | null;
  readonly fetched: number;
}
export interface StoredImage { readonly file: string; readonly name: FileName; }

// application/ports/image-measurer.ts
export interface ImageMeasurer { measure(file: string): PixelSize | null; }

// application/ports/file-system.ts
export interface FileSystem {
  exists(path: string): boolean;
  readText(path: string): string | null;
  readBytes(path: string): Uint8Array | null;
  writeText(path: string, text: string): void;
  writeBytes(path: string, bytes: Uint8Array): void;
  copy(from: string, to: string): void;
  makeDirs(path: string): void;
  removeTree(path: string): void;
  listFiles(dir: string): string[];   // absolute
  listDirs(dir: string): string[];    // absolute
}

// application/ports/template-store.ts
export interface TemplateStore {
  layout(): string;
  contentCss(): string;
  siteCss(): string;
  texPreamble(): string;
  bookCss(path: string): string;      // the book's own web.css, or ""
  headHtml(path: string): string;     // the book's own web.head, or ""
}

// application/ports/http-client.ts
export interface HttpClient {
  get(url: string, opts: { timeoutMs: number }): Promise<HttpResponse>;
}
export interface HttpResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly contentType: string;
  readonly body: Uint8Array;
}

// application/ports/process-runner.ts
export interface ProcessRunner {
  run(cmd: string, args: readonly string[], opts: { cwd?: string }): ProcessResult;
}
export type ProcessResult =
  | { kind: "ok" }
  | { kind: "failed"; message: string }
  | { kind: "missing"; tool: string };

// application/ports/pdf-toolchain.ts
export interface PdfToolchain {
  compile(texDir: string, jobname: string, passes: readonly TexPass[]): Result<void>;
  svgToPdf(svgFile: string, pdfFile: string): Result<void>;
  pageCount(pdfFile: string): Promise<Result<number>>;
}
export type TexPass = "draft" | "final";

// application/ports/config-source.ts
export interface ConfigSource { read(): RawConfig; }   // RawConfig = unknown JSON + file path
```

```ts
// application/ports/reporter.ts
export interface Reporter { report(d: Diagnostic): void; }
// application/ports/logger.ts
export interface Logger { info(message: string): void; }
```

### 7.2 Diagnostics (failures as values)

```ts
// domain/diagnostics.ts
export type Severity = "error" | "warning" | "note";

export interface Diagnostic {
  readonly severity: Severity;
  readonly code: string;                        // stable id: "link/missing", "chapter/no-h1"
  readonly message: string;
  readonly locus?: { file: string; line?: number; column?: number };
}

export type Result<T> = { readonly ok: true; readonly value: T }
                      | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] };

export const ok  = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = (d: Diagnostic, ...rest: Diagnostic[]): Result<never> =>
  ({ ok: false, diagnostics: [d, ...rest] });
```

Every use case returns a `Result`. Nothing in `domain` or `application` touches
`process`, `console`, or an exit code.

### 7.3 The settings object

```ts
// application/settings.ts
export interface BookSettings {
  readonly root: string;
  readonly configFile: string;
  readonly metadata: BookMetadata;
  readonly sources: SourceLayout;        // bookDir, summary, chapters, readme, cover, docs
  readonly outputs: OutputLayout;        // web, pdf, clean
  readonly printing: PrintingSettings;   // geometry, palette, type, class, side, tocDepth, titlePage, …
  readonly website: WebsiteSettings;     // css, head, baseUrl, description, favicon, prettyUrls, links
  readonly fonts: FontFamilies;
  readonly diagrams: DiagramSettings;    // theme, fontSize
  readonly code: CodeLanguageTable;      // the book's own languages
  readonly languages: ReadonlySet<string>;
  readonly lint: LintBudgets;
  readonly markdown: MarkdownSettings;   // smartTypography
  readonly images: ImageSettings;        // timeout, contentTypes
  readonly serve: ServeSettings;
  readonly strings: UiStrings;
  readonly placeholders: PlaceholderMap;
}
```

`loadSettings` is a pure function (over `RawConfig` + the package metadata) that
returns `{ settings, diagnostics }`. Leniency is a property of the readers in
`lenient-readers.ts`; diagnostics surface what was ignored, exactly as the
`config` lint family does today but at load time too.

---

## 8. The source pipeline (one path to the model)

Today, `build-web-book/cli.ts` and `build-tex-book/parse.ts` each order the same
five steps slightly differently (substitute, fetch remote, extract diagrams,
parse, assemble). The target has one function:

```ts
// application/pipelines/source-to-model.ts
export interface SourceDeps {
  readonly markdown: MarkdownParser;
  readonly diagrams: DiagramRenderer;
  readonly images: ImageStore;
  readonly settings: BookSettings;
}

export interface ChapterContext {
  readonly id: ChapterId;
  readonly path: BookPath;
  readonly chapterIds: ReadonlyMap<BookPath, ChapterId>;
}

/**
 * Raw Markdown → a Chapter model, with every asset the build must prepare
 * already registered. The one pipeline both editions call.
 */
export async function sourceToModel(
  source: string,
  ctx: ChapterContext,
  deps: SourceDeps,
): Promise<Result<Chapter>>;
```

Its body is the five steps, each now in exactly one place:

1. **Substitute placeholders** (domain, pure) — fenced code left alone.
2. **Fetch remote images** (application, via `ImageStore` port) — a failed fetch
   becomes a `Diagnostic` with the URL.
3. **Extract diagrams** (pure) — ` ```mermaid ` fences become indexed
   placeholders; the sources are kept.
4. **Lex** (adapter, via `MarkdownParser`) + **smart-typography** (domain) on the
   neutral tree.
5. **Render diagrams** (adapter, via `DiagramRenderer`) and **assemble** (domain,
   pure) — attach figures, images and the `AnchorIndex`.

Both `build-website` and `build-pdf` call `sourceToModel`. There is no second
order to drift.

---

## 9. Renderers: pure adapters over one model

### 9.1 HTML

```ts
// adapters/render-html/html-renderer.ts
export interface HtmlContext {
  readonly from: OutputPath;                        // the page being rendered
  readonly pageOf: ReadonlyMap<BookPath, OutputPath>;
  readonly assetOf: ReadonlyMap<FileName, OutputPath>;
  readonly basePath: string;
  readonly settings: BookSettings;
}

/** Chapter (without chrome) → an HTML fragment. Pure: no filesystem. */
export function renderChapterBody(chapter: Chapter, ctx: HtmlContext): string;
export function renderInline(nodes: readonly Inline[], ctx: HtmlContext): string;
export function renderBlock(block: Block, ctx: HtmlContext): string;
```

Link rewriting and image rewriting stop being string surgery on HTML (today's
`build-web-book/links.ts`). A `LinkTarget` is rendered with `hrefFor(target,
ctx)`; an `ImageSource` with `srcFor(source, ctx)`. Because the model already
holds classified links, a regex that misses a `href` shape is no longer possible.

The page **shell** (document template, head script, sidebar, footer, meta tags,
`{path}`/`{url}` footer links) lives in `adapters/web/page-shell.ts` and
`navigation.ts` and is pure string work.

### 9.2 LaTeX

`render-tex/tex-renderer.ts` is today's `build-tex-book/tex.ts` with one change:
it consumes the domain `Chapter` instead of the local IR (they are the same
shape now). `tex-escape.ts`, `tex-figures.ts`, `front-matter.ts`,
`preamble-loader.ts` and `preamble.tex` move beside it unchanged.

### 9.3 The parity guarantee

Because both renderers read `Heading.anchors`, `Inline.link.target` and
`ImageNode.source`, the "same anchor in both editions" property is *typed*, not
tested. The existing parity suite (`test/parity/`) shrinks to a smoke test that
both renderers run over the golden chapter; it can no longer catch a drift
because a drift is no longer representable.

---

## 10. Writers and use cases

Renderers are pure. **Writing** is a use case orchestrating renderer + ports.

```ts
// application/usecases/build-website.ts
export interface BuildWebsiteDeps {
  readonly settings: BookSettings;
  readonly fs: FileSystem;
  readonly templates: TemplateStore;
  readonly markdown: MarkdownParser;
  readonly diagrams: DiagramRenderer;
  readonly images: ImageStore;
  readonly logger: Logger;
}

export async function buildWebsite(
  deps: BuildWebsiteDeps,
  outputDir?: string,
): Promise<Result<{ chapters: number; fetched: number }>>;
```

Steps: plan the book → clean output if configured → write shared assets → for the
front page and each chapter, `sourceToModel` then `renderChapterBody` then the
page shell then `fs.writeText`; copy each `ImageAsset` and write each `Figure`.
Failures accumulate into `Diagnostic[]`; a single failed page returns `fail(...)`.

```ts
// application/usecases/build-pdf.ts
export interface BuildPdfDeps {
  readonly settings: BookSettings;
  readonly fs: FileSystem;
  readonly templates: TemplateStore;
  readonly markdown: MarkdownParser;
  readonly diagrams: DiagramRenderer;
  readonly images: ImageStore;
  readonly imageSizes: ImageMeasurer;
  readonly tools: PdfToolchain;
  readonly logger: Logger;
}
export async function buildPdf(deps: BuildPdfDeps, outputPdf?: string): Promise<Result<PdfReport>>;
```

`PdfReport` carries chapter count, page count, broken labels (the
unresolved-reference check, now a returned `Diagnostic[]` instead of a parsed log
tail).

`plan-book.ts` is shared: SUMMARY + filesystem → `Toc` + ordered written
chapters, with the same ids both editions use.

Other use cases: `lint-book`, `render-standalone`, `serve-site`, `pdf-info`,
`show-config`, each declaring only the ports it needs.

---

## 11. The adapters

Thin, one concern each, and the **only** place a technology appears:

| Port | Adapter | Imports |
| --- | --- | --- |
| `MarkdownParser` | `markdown/marked-parser.ts` | `marked` |
| `DiagramRenderer` | `diagrams/mermaid-renderer.ts` (+ `jsdom-shims.ts`) | `mermaid`, `jsdom` |
| `ImageStore` | `http/remote-image-store.ts` | `node:crypto`, `http-client` |
| `ImageMeasurer` | `http/image-measurer.ts` (png/jpeg header walk) | — |
| `FileSystem` | `fs/node-file-system.ts` | `node:fs` |
| `HttpClient` | `http/node-http-client.ts` | `fetch` |
| `ProcessRunner` | `process/node-process-runner.ts` | `node:child_process` |
| `PdfToolchain` | `process/system-pdf-toolchain.ts` | `ProcessRunner` |
| `ConfigSource` | `config/file-config-source.ts` | `node:fs` |
| `TemplateStore` | `templates/asset-template-store.ts` | `node:fs`, `import.meta.url` |
| `Reporter` | `reporting/console-reporter.ts` | `console`/`process` (streams injected) |

Two structural wins:

- **`marked` is imported once.** Today six modules import it; the proof is in the
  appendix. After the refactor, `grep -R 'from "marked"' src` returns one path.
- **The environment is faked in tests.** Because `FileSystem`, `HttpClient`,
  `ProcessRunner` and `PdfToolchain` are ports, a build can be exercised against
  an in-memory filesystem and a fake LaTeX, with no jsdom, no network and no
  toolchain.

Plain assets move next to their reader: `_layouts/default.html` →
`adapters/templates/`, `src/build-web-book/site.css` → `adapters/web/site.css`,
`src/lib/content.css` → `adapters/render-html/content.css`,
`src/build-tex-book/preamble.tex` → `adapters/render-tex/preamble.tex`. The
engine still has no CSS or LaTeX build step; they are read by a
`TemplateStore`.

---

## 12. Composition root and the CLI

The CLI is the only place where the whole object graph is assembled. Each command
is a thin function `(ctx) => Promise<number>`.

```ts
// cli/main.ts
export async function main(argv: string[]): Promise<number> {
  const cwd = process.cwd();
  const { file } = takeConfigOption(argv);                 // pure

  const configSource = new FileConfigSource(cwd, file);    // adapter
  const loaded = loadSettings(configSource.read());        // application (pure)

  const reporter = new ConsoleReporter(process.stdout, process.stderr);
  for (const d of loaded.diagnostics) reporter.report(d);

  const ctx: AppContext = {                                 // adapters wired in
    settings: loaded.settings,
    fs: new NodeFileSystem(),
    templates: new AssetTemplateStore(),
    markdown: new MarkedParser(),
    diagrams: new MermaidDiagramRenderer(),
    images: new CachingRemoteImageStore(new NodeHttpClient(), loaded.settings.images),
    imageSizes: new HeaderImageMeasurer(),
    tools: new SystemPdfToolchain(new NodeProcessRunner()),
    reporter,
    logger: new ConsoleLogger(process.stdout),
  };

  const command = COMMANDS[argv[0]] ?? usage;
  const result = await command(ctx, argv.slice(1));
  return result.ok ? 0 : (report(result, reporter), exitCodeFor(result));
}
```

There is no DI container: a plain object is enough, and it keeps the wiring
readable in one file. The command table mirrors today's, so the CLI surface is
unchanged.

---

## 13. Enforcement (fitness functions)

The architecture is only real if the build fails when it is violated. Add:

- **`dependency-cruiser`** with forbidden rules:

  ```js
  // .dependency-cruiser.cjs
  forbidden: [
    { name: "domain-is-pure",
      from: { path: "^src/domain" },
      to:   { pathNot: "^src/domain" } },
    { name: "application-depends-on-domain-only",
      from: { path: "^src/application" },
      to:   { path: "^src/(adapters|cli)" } },
    { name: "adapters-avoid-cli",
      from: { path: "^src/adapters" },
      to:   { path: "^src/cli" } },
    { name: "marked-only-in-its-adapter",
      from: { pathNot: "^src/adapters/markdown" },
      to:   { path: "^node_modules/marked" } },
    { name: "no-node-builtins-in-domain-or-application",
      from: { path: "^src/(domain|application)" },
      to:   { dependencyTypes: ["core"] } },
  ]
  ```

- A **`just boundaries`** recipe running `depcruise src` and an **architecture
  test** (`test/architecture.test.ts`) that asserts the same rules, so a
  violation is caught locally, in pre-commit and in CI with no extra service.

- The rules §2 marked **[auto]** are exactly the ones these checks encode.

Because they are about imports, they are deterministic and fast, and they encode
the *why* of §3 permanently.

---

## 14. Current → target mapping

| Current | Target |
| --- | --- |
| `cli.ts` | `cli/main.ts` + `cli/commands/*` |
| `lib/book-config/{types,defaults}.ts` | `domain/values/*`, `application/settings.ts` |
| `lib/book-config/validators.ts` | `adapters/config/lenient-readers.ts` (pure) |
| `lib/book-config/load.ts` | `adapters/config/file-config-source.ts` + `application/usecases/load-settings.ts` |
| `lib/summary.ts` | `domain/model/toc.ts` (pure parser) |
| `lib/markdown.ts` | `domain/values/anchor.ts` (slug) + `adapters/markdown/marked-parser.ts` |
| `lib/content-placeholders.ts` | `domain/values/placeholders.ts` |
| `lib/smart-typography.ts` | `domain/values/smart-typography.ts` (over the neutral tree) |
| `lib/code-tokens.ts` | `domain/services/code-tokenizer.ts` |
| `lib/code-meta.ts`, `lib/langs.ts` | `domain/values/code-language.ts` |
| `lib/images.ts` | `domain/services/resolve-images.ts` + `domain/values/paths.ts` |
| `lib/image-size.ts` | `adapters/http/image-measurer.ts` |
| `lib/remote-images.ts` | `adapters/http/remote-image-store.ts` + `application/ports/image-store.ts` |
| `lib/fonts.ts` | `domain/values/fonts.ts` + `adapters/render-html/stylesheets.ts` |
| `lib/web-palette.ts` | `adapters/render-html/stylesheets.ts` (from `domain/values/palette.ts`) |
| `lib/site-meta.ts` | `adapters/render-html/site-meta.ts` |
| `lib/html.ts` | `adapters/render-html/escape.ts` |
| `lib/css.ts` | part of `adapters/templates/asset-template-store.ts` |
| `lib/ui-strings.ts` | `domain/values/ui-strings.ts` |
| `build-web-book/cli.ts` | `application/usecases/build-website.ts` |
| `build-web-book/page.ts` | `adapters/web/page-shell.ts` |
| `build-web-book/nav.ts` | `adapters/web/navigation.ts` |
| `build-web-book/links.ts` | dissolved into `adapters/render-html/html-renderer.ts` |
| `build-web-book/site.ts`, `site.css` | `adapters/web/*` |
| `build-tex-book/ir.ts` | `domain/model/{chapter,inline,assets}.ts` |
| `build-tex-book/{blocks,inlines,state,entities}.ts` | `domain/services/assemble.ts` |
| `build-tex-book/links.ts` | `domain/services/resolve-links.ts` |
| `build-tex-book/images.ts` | `domain/services/resolve-images.ts` |
| `build-tex-book/parse.ts` | `application/pipelines/source-to-model.ts` |
| `build-tex-book/{tex,escape,figures}.ts` | `adapters/render-tex/*` |
| `build-tex-book/{preamble,front-matter}.ts` + `preamble.tex` | `adapters/render-tex/*` |
| `build-tex-book/cli.ts` | `application/usecases/build-pdf.ts` + `adapters/process/system-pdf-toolchain.ts` |
| `diagrams/render.ts` | `adapters/diagrams/mermaid-renderer.ts` |
| `diagrams/{shims,theme,fixup}.ts` | `adapters/diagrams/{jsdom-shims,mermaid-theme,svg-fixup}.ts` |
| `lint/cli.ts` | `application/usecases/lint-book.ts` |
| `lint/{chapter,summary,links,config,markdown,paths,errors}.ts` | `adapters/lint/*` (checks over the model) + `domain/diagnostics.ts` |
| `md-to-html/render.ts` | `application/usecases/render-standalone.ts` + `adapters/render-html/*` |
| `md-to-html/cli.ts` | `cli/commands/md.ts` |
| `serve/cli.ts` | `cli/serve/static-server.ts` + `application/usecases/serve-site.ts` |
| `pdf-info/{cli,pdf}.ts` | `cli/commands/pdf-info.ts` + `adapters/process/system-pdf-toolchain.ts` |
| `_layouts/default.html` | `adapters/templates/default-layout.html` |

---

## 15. How this resolves today's tensions

| Today's tension (from `CURRENT_ARCHITECTURE.md` §16) | Resolution |
| --- | --- |
| `lib/markdown.ts` ↔ `md-to-html/render.ts` back-edge | The comment highlighter becomes a `domain/services` function; the `marked` renderer hooks disappear because HTML is rendered from the model, not by `marked`. No back-edge exists. |
| Two pipelines ordering the same five steps differently | One `source-to-model` pipeline, one order. |
| Web HTML patched by regex; print parsed into a tree | One model, two pure renderers; no regex rewriting. |
| Linter re-parses Markdown and re-derives slugs | Lint reads the model and the shared `AnchorIndex`; only style checks read raw lines. |
| Builders write `stderr` and pick exit codes inline | Diagnostics returned as values; the CLI is the only exit-code authority. |
| Untestable build orchestration (fs, jsdom, LaTeX) | Ports + in-memory fakes; orchestration is unit-testable. |
| `marked`/`node:fs` spread across layers | One importer each, enforced by `dependency-cruiser`. |
| String paths of four different meanings | Branded `BookPath`/`OutputPath`/`SourcePath`. |

---

## 16. Testing strategy, by layer

- **Domain** — pure unit tests, zero mocks: `slugify`, anchor rules,
  `assemble`, `smart-typography`, `code-tokenizer`, geometry, placeholders.
- **Application** — use cases with fake ports: an in-memory `FileSystem`, a
  `MarkdownParser` fake returning a fixed neutral tree, a `DiagramRenderer` fake
  returning a canned `Figure`, an `ImageStore` fake, a `PdfToolchain` fake.
  Build flows become fast and deterministic.
- **Adapters** — focused: the `marked` adapter against a golden neutral tree; the
  HTML renderer against golden HTML; the TeX renderer against golden TeX; a
  remaining jsdom/Mermaid smoke test as the one integration that touches a
  browser shim.
- **Contract** — the parity suite keeps one assertion: both renderers over the
  golden chapter produce the same anchors. It can no longer fail for drift,
  because drift is unrepresentable.
- **End to end** — unchanged: `just lint && just html && just pdf` build the
  engine's own guide in CI, in Docker.

Gone: the jsdom shim in the unit test path, the network in the unit test path,
the LaTeX toolchain in the unit test path.

---

## 17. Deliberate non-goals

Clean architecture fails when it is over-applied. The target explicitly avoids:

- **A DI container or decorators.** A plain context object wired in `cli/main.ts`
  is clearer and has no runtime cost.
- **Splitting into npm packages / a monorepo.** One package, four folders, one
  dependency rule. Publishing boundaries can come later if ever needed.
- **Events, CQRS, repositories, aggregates with identity maps.** A book is an
  immutable document value; a `Book` is data, not a lifecycle.
- **Abstracting the filesystem past a thin interface.** `FileSystem` mirrors the
  few operations the engine needs; it is not an emulation of POSIX.
- **Replacing `marked` for its own sake.** It is hidden behind a port; that is
  enough.
- **Making the domain async.** Only the shell is async. The core stays
  synchronous and total.
- **Changing any observable behaviour.** No config key, flag, output, message or
  exit code moves. If a change would alter output, it is out of scope.
- **A big-bang rewrite.** §18 migrates in phases, each keeping the book building.

The guiding test: *does this change make an illegal dependency impossible, or a
shared fact impossible to duplicate?* If not, it is ceremony.

---

## 18. Migration plan (keep the book building)

Each phase ends with `just lint && just test && just html && just pdf` green and
the guide's output unchanged.

1. **Boundaries first, no moves.** Add `dependency-cruiser` with the §13 rules in
   reporting mode, and a `Result`/`Diagnostic` module. No behaviour change. This
   makes the current violations visible.
2. **Extract the domain.** Move `ir.ts`, `slugify`, `code-tokens`,
   `smart-typography`, `placeholders`, `code-language`, `ui-strings`, `geometry`
   into `domain/`, with re-export shims so importers do not change yet.
3. **Introduce the neutral tree.** Add the `MarkdownParser` port and the `marked`
   adapter; port the print walk (`assemble.ts`) onto neutral nodes. The print
   build switches to it; parity tests prove equality.
4. **One HTML renderer.** Build `renderChapterBody` over the model; switch the
   web build to it; delete `marked`'s renderer hooks and the regex rewriters.
   Retire the shims and update golden files (same bytes).
5. **Ports for the environment.** Extract `FileSystem`, `HttpClient`,
   `ProcessRunner`, `PdfToolchain`, `ImageStore`, `DiagramRenderer`,
   `TemplateStore`, `ConfigSource`, `Reporter`. Wire them in `cli/main.ts`.
6. **Lint onto the model.** Replace regex re-parsing with model + `AnchorIndex`;
   keep style checks on raw lines. Assert the same diagnostics on the guide.
7. **Collapse the layers.** Delete the re-export shims; turn on `dependency-cruiser`
   in *failing* mode; move assets beside their adapters.

Phases 1–4 deliver the bulk of the value (one model, one pipeline, one anchor
rule); 5–7 deliver the testability and the enforcement.

---

## Appendix — the coupling this fixes, measured

A `grep` of the current tree (see `CURRENT_ARCHITECTURE.md` for context):

```code
importers of "marked":  build-tex-book/blocks.ts · build-tex-book/images.ts ·
                        build-tex-book/inlines.ts · lib/markdown.ts ·
                        lib/remote-images.ts · lib/smart-typography.ts
importers of "node:fs": 20 files across lib/, build-*, lint/, md-to-html/, pdf-info/, serve/
importers of "mermaid": diagrams/theme.ts        importers of "jsdom": diagrams/shims.ts
importers of "node:child_process": build-tex-book/cli.ts · pdf-info/*, serve uses node:http
```

Target:

```code
importers of "marked":            1  (adapters/markdown/marked-parser.ts)
importers of "mermaid"/"jsdom":   2  (adapters/diagrams/*)
importers of "node:*":            only src/adapters/** and src/cli/**
importers of anything outside domain/ inside domain/: 0
```

The last line is the whole document in one sentence.
