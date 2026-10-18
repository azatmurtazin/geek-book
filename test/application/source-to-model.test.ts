// The source pipeline, pinned with fake ports: the order of its steps, the
// names it gives each drawing, and the model it hands back. The real Mermaid
// path stays covered by `test/diagrams/render.test.ts`; this suite pins the
// wiring, not the drawing.

import { describe, expect, it } from "vitest";
import { sourceToModel, type SourceDeps } from "../../src/application/pipelines/source-to-model.js";
import type { DiagramRenderer } from "../../src/application/ports/diagram-renderer.js";
import type { ImageStore, StoredImage } from "../../src/application/ports/image-store.js";
import type { MarkdownParser } from "../../src/application/ports/markdown-parser.js";
import type { Figure } from "../../src/domain/model/assets.js";
import type { ChapterContext } from "../../src/domain/model/chapter.js";
import type { MdNode } from "../../src/domain/model/markdown.js";

const CTX: ChapterContext = {
  chapterId: 3,
  relBook: "chapters/01_start/02_run.md",
  idOf: new Map([["chapters/01_start/03_next.md", 4]]),
};

/** An in-memory parser: records the source it was handed, returns its tree. */
class FakeParser implements MarkdownParser {
  readonly sources: string[] = [];
  constructor(private readonly tree: MdNode[]) {}
  lex(source: string): MdNode[] {
    this.sources.push(source);
    return this.tree;
  }
}

/** A renderer that draws nothing: a canned SVG under whatever name it gets. */
class FakeRenderer implements DiagramRenderer {
  readonly calls: { source: string; id: string; name: string }[] = [];
  async render(source: string, id: string, name: string): Promise<Figure> {
    this.calls.push({ source, id, name });
    return { name, svg: `<svg data-id="${id}"></svg>`, size: { width: 10, height: 20 } };
  }
}

/** An in-memory store: fetches nothing, but records its input and can fail. */
class FakeStore implements ImageStore {
  readonly collected: string[] = [];
  fetched = 0;
  constructor(
    private readonly found: Map<string, StoredImage> = new Map(),
    private readonly fails = false,
  ) {}
  async collect(markdown: string): Promise<void> {
    this.collected.push(markdown);
    if (this.fails) {
      throw new Error("cannot fetch image https://example.org/bird.png: boom");
    }
    this.fetched = this.found.size;
  }
  lookup(url: string): StoredImage | null {
    return this.found.get(url) ?? null;
  }
}

function makeDeps(over: Partial<SourceDeps> = {}): SourceDeps {
  return {
    markdown: new FakeParser([]),
    diagrams: new FakeRenderer(),
    images: new FakeStore(),
    substitute: (source) => source,
    smartTypography: false,
    bookDir: "book",
    diagramName: (index) => ({ id: `dgm-${index}`, name: `f-${index}.pdf` }),
    ...over,
  };
}

describe("sourceToModel — the one order", () => {
  it("fills placeholders, fetches, then hands the fence-free source to the parser", async () => {
    const parser = new FakeParser([]);
    const store = new FakeStore();
    const deps = makeDeps({
      markdown: parser,
      images: store,
      substitute: (source) => source.replace("{{ version }}", "1.2.3"),
    });
    const source = "# Title\n\n{{ version }}\n\n```mermaid\nflowchart LR\n```\n";

    const result = await sourceToModel(source, CTX, deps);

    expect(result.ok).toBe(true);
    expect(store.collected).toEqual([expect.stringContaining("1.2.3")]);
    expect(parser.sources).toHaveLength(1);
    expect(parser.sources[0]).toContain("1.2.3");
    expect(parser.sources[0]).toContain("::gb-diagram-1::");
    expect(parser.sources[0]).not.toContain("mermaid");
  });
});

describe("sourceToModel — drawings", () => {
  it("draws each fence under the id and figure name the builder chose", async () => {
    const renderer = new FakeRenderer();
    const deps = makeDeps({
      diagrams: renderer,
      diagramName: (index) => ({ id: `tex-dgm-3-${index}`, name: `c3-d${index}.pdf` }),
    });

    const result = await sourceToModel("```mermaid\nflowchart LR\n```\n", CTX, deps);

    expect(renderer.calls).toEqual([{ source: "flowchart LR", id: "tex-dgm-3-1", name: "c3-d1.pdf" }]);
    if (!result.ok) throw new Error("expected ok");
    expect([...result.value.diagrams.entries()]).toEqual([[1, '<svg data-id="tex-dgm-3-1"></svg>']]);
  });
});

describe("sourceToModel — the model", () => {
  it("returns the chapter, its drawings and the source the old renderers need", async () => {
    const tree: MdNode[] = [
      { type: "heading", depth: 1, inline: [{ type: "text", text: "Title" }] },
      { type: "paragraph", inline: [{ type: "image", href: "images/bird.png", alt: "A bird" }] },
    ];
    const deps = makeDeps({ markdown: new FakeParser(tree) });

    const result = await sourceToModel("```mermaid\nflowchart LR\n```\n", CTX, deps);

    if (!result.ok) throw new Error("expected ok");
    const { chapter, markdown, diagrams } = result.value;
    expect(chapter.blocks[0]).toMatchObject({ kind: "heading", anchors: ["c3", "c3--title"] });
    expect(chapter.images).toEqual([{ relBook: "chapters/01_start/images/bird.png", name: "c3-i0.png" }]);
    expect(chapter.figures.map((figure) => figure.name)).toEqual(["f-1.pdf"]);
    expect(markdown).toContain("::gb-diagram-1::");
    expect(diagrams.get(1)).toBe('<svg data-id="dgm-1"></svg>');
  });

  it("resolves a remote picture through the store", async () => {
    const url = "https://example.org/bird.png";
    const store = new FakeStore(new Map([[url, { file: "/tmp/abc.png", name: "abc.png" }]]));
    const tree: MdNode[] = [{ type: "paragraph", inline: [{ type: "image", href: url, alt: "bird" }] }];
    const deps = makeDeps({ markdown: new FakeParser(tree), images: store });

    const result = await sourceToModel("", CTX, deps);

    if (!result.ok) throw new Error("expected ok");
    expect(result.value.chapter.blocks[0]).toMatchObject({
      kind: "image",
      ref: { file: "/tmp/abc.png", name: "abc.png" },
      alt: "bird",
    });
  });
});

describe("sourceToModel — failures and typography", () => {
  it("turns a failed fetch into a diagnostic, not a throw", async () => {
    const deps = makeDeps({ images: new FakeStore(new Map(), true) });

    const result = await sourceToModel("", CTX, deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.diagnostics).toEqual([
      {
        severity: "error",
        code: "image/fetch",
        message: "cannot fetch image https://example.org/bird.png: boom",
      },
    ]);
  });

  it("smartens the prose when the config asks for it", async () => {
    const tree = (): MdNode[] => [
      { type: "paragraph", inline: [{ type: "text", text: 'He said "hi"' }] },
    ];

    const off = await sourceToModel("", CTX, makeDeps({ markdown: new FakeParser(tree()) }));
    const on = await sourceToModel(
      "",
      CTX,
      makeDeps({ markdown: new FakeParser(tree()), smartTypography: true }),
    );

    if (!off.ok || !on.ok) throw new Error("expected ok");
    expect(off.value.chapter.blocks[0]).toMatchObject({ content: [{ kind: "text", text: 'He said "hi"' }] });
    expect(on.value.chapter.blocks[0]).toMatchObject({
      content: [{ kind: "text", text: "He said \u201chi\u201d" }],
    });
  });
});
