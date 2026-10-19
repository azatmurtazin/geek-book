// The walk: the neutral Markdown tree → the book's document tree.
//
// It reads hand-built neutral nodes, so nothing here depends on `marked`: the
// entity decoding, link resolution, picture registration, diagram substitution
// and smart typography the walk owns are all pinned directly.

import path from "node:path";
import { describe, expect, it } from "vitest";
import { assemble, type AssembleOptions } from "../../src/domain/services/assemble.js";
import type { Figure } from "../../src/domain/model/assets.js";
import type { MdInline, MdNode } from "../../src/domain/model/markdown.js";
import { fixtureConfig } from "../helpers/config.js";
import { chapterContext } from "../helpers/chapter.js";

const cfg = fixtureConfig();
const ctx = chapterContext();

/** The chapter a hand-built node list assembles to. */
function build(nodes: MdNode[], options: Partial<AssembleOptions> = {}) {
  return assemble(nodes, ctx, { bookDir: cfg.bookDir, ...options });
}

const text = (value: string): MdInline => ({ type: "text", text: value });

describe("assemble — headings and their anchors", () => {
  it("a chapter title wears the chapter id and its own slug", () => {
    expect(build([{ type: "heading", depth: 1, inline: [text("Hello, World!")] }]).blocks[0]).toEqual({
      kind: "heading",
      depth: 1,
      text: [{ kind: "text", text: "Hello, World!" }],
      anchors: ["c3", "c3--hello-world"],
    });
  });

  it("a section wears the slug alone", () => {
    expect(build([{ type: "heading", depth: 2, inline: [text("Set Up")] }]).blocks[0]).toMatchObject({
      kind: "heading",
      depth: 2,
      anchors: ["c3--set-up"],
    });
  });

  it("slugs the raw text, entities and all, as the web id does", () => {
    expect(build([{ type: "heading", depth: 2, inline: [text("A &amp; B")] }]).blocks[0]).toMatchObject({
      anchors: ["c3--a-amp-b"],
    });
  });
});

describe("assemble — inline content", () => {
  it("carries pieces in order, decoding entities", () => {
    expect(
      build([
        {
          type: "paragraph",
          inline: [
            text("a &lt; "),
            { type: "code", text: "code" },
            { type: "strong", children: [text("bold &amp; ")] },
            { type: "em", children: [text("em")] },
            { type: "del", children: [text("gone")] },
            { type: "break" },
            text("after"),
          ],
        },
      ]).blocks[0],
    ).toEqual({
      kind: "paragraph",
      content: [
        { kind: "text", text: "a < " },
        { kind: "code", text: "code" },
        { kind: "strong", content: [{ kind: "text", text: "bold & " }] },
        { kind: "em", content: [{ kind: "text", text: "em" }] },
        { kind: "del", content: [{ kind: "text", text: "gone" }] },
        { kind: "break" },
        { kind: "text", text: "after" },
      ],
    });
  });

  it("turns a raw HTML inline into literal text", () => {
    expect(build([{ type: "paragraph", inline: [{ type: "html", text: "<b>" }] }]).blocks[0]).toEqual({
      kind: "paragraph",
      content: [{ kind: "text", text: "<b>" }],
    });
  });
});

describe("assemble — where a link points", () => {
  function targetOf(href: string): string | null {
    const block = build([{ type: "paragraph", inline: [{ type: "link", href, children: [text("t")] }] }]).blocks[0];
    return (block as { content: { target: string | null }[] }).content[0].target;
  }

  it("resolves a within-chapter anchor to the chapter's heading", () => {
    expect(targetOf("#set-up")).toBe("c3--set-up");
  });

  it("resolves a relative .md path through the chapter map", () => {
    expect(targetOf("03_next.md")).toBe("c4");
    expect(targetOf("03_next.md#part")).toBe("c4--part");
  });

  it("leaves an outside URL, an unknown path and a bare hash with no target", () => {
    expect(targetOf("https://example.com/x")).toBeNull();
    expect(targetOf("missing.md")).toBeNull();
    expect(targetOf("#")).toBeNull();
  });

  it("keeps the href verbatim beside the target", () => {
    const block = build([{ type: "paragraph", inline: [{ type: "link", href: "03_next.md#part", children: [text("t")] }] }])
      .blocks[0] as { content: unknown[] };
    expect(block.content[0]).toMatchObject({ kind: "link", href: "03_next.md#part", target: "c4--part" });
  });
});

describe("assemble — pictures", () => {
  it("a picture alone in a paragraph becomes an image block, and registers a copy", () => {
    const chapter = build([{ type: "paragraph", inline: [{ type: "image", href: "images/bird.png", alt: "A bird" }] }]);
    expect(chapter.blocks[0]).toEqual({
      kind: "image",
      src: "images/bird.png",
      ref: { file: path.join(cfg.bookDir, "chapters/01_start/images/bird.png"), name: "c3-i0.png" },
      alt: "A bird",
    });
    expect(chapter.images).toEqual([{ relBook: "chapters/01_start/images/bird.png", name: "c3-i0.png" }]);
  });

  it("a picture among words stays inline", () => {
    const block = build([
      { type: "paragraph", inline: [text("see "), { type: "image", href: "images/a.png", alt: "alt" }, text(" here")] },
    ]).blocks[0];
    expect(block.kind).toBe("paragraph");
    expect((block as { content: { kind: string }[] }).content.map((n) => n.kind)).toEqual(["text", "image", "text"]);
  });

  it("a picture alone in a text run stays prose, not a figure", () => {
    // A tight list item has no block of its own; the old walk left a lone
    // picture there inline, and so does this one.
    const block = build([{ type: "text", inline: [{ type: "image", href: "images/a.png", alt: "alt" }] }]).blocks[0];
    expect(block).toMatchObject({ kind: "paragraph", content: [{ kind: "image" }] });
  });

  it("repeats of one source reuse a single copy", () => {
    const chapter = build([
      { type: "paragraph", inline: [{ type: "image", href: "images/a.png", alt: "one" }] },
      { type: "paragraph", inline: [{ type: "image", href: "images/a.png", alt: "two" }] },
    ]);
    expect(chapter.images).toHaveLength(1);
    expect((chapter.blocks[0] as { ref: { name: string } }).ref.name).toBe("c3-i0.png");
    expect((chapter.blocks[1] as { ref: { name: string } }).ref.name).toBe("c3-i0.png");
  });

  it("a fetched remote picture reads through the callback", () => {
    const chapter = build([{ type: "paragraph", inline: [{ type: "image", href: "https://x.example/a.png", alt: "x" }] }], {
      remoteFile: (url) => (url === "https://x.example/a.png" ? "/fetched/abc.png" : null),
    });
    expect(chapter.blocks[0]).toMatchObject({ kind: "image", ref: { file: "/fetched/abc.png", name: "abc.png" } });
  });

  it("a scheme nothing fetches falls back to the alt text", () => {
    const node = build([{ type: "paragraph", inline: [{ type: "image", href: "data:image/png;base64,AAAA", alt: "x" }] }])
      .blocks[0] as { ref: unknown; alt: string };
    expect(node.ref).toBeNull();
    expect(node.alt).toBe("x");
  });
});

describe("assemble — blocks", () => {
  it("a fence folds its language and keeps its code", () => {
    expect(build([{ type: "code", lang: "Rust", text: "fn main() {}", escaped: false }]).blocks[0]).toEqual({
      kind: "code",
      lang: "rust",
      code: "fn main() {}",
    });
  });

  it("a blockquote becomes a callout of blocks", () => {
    expect(build([{ type: "blockquote", children: [{ type: "paragraph", inline: [text("Note this")] }] }]).blocks[0]).toEqual({
      kind: "callout",
      blocks: [{ kind: "paragraph", content: [{ kind: "text", text: "Note this" }] }],
    });
  });

  it("a rule becomes a rule", () => {
    expect(build([{ type: "rule" }]).blocks[0]).toEqual({ kind: "rule" });
  });

  it("an html block becomes a paragraph of literal text", () => {
    expect(build([{ type: "html", text: "<div>&amp;</div>" }]).blocks[0]).toEqual({
      kind: "paragraph",
      content: [{ kind: "text", text: "<div>&</div>" }],
    });
  });
});

describe("assemble — lists and tables", () => {
  it("keeps whether a list is ordered, where it starts, and each item's blocks", () => {
    const items: MdNode[][] = [
      [{ type: "paragraph", inline: [text("three")] }],
      [{ type: "paragraph", inline: [text("four")] }],
    ];
    expect(build([{ type: "list", ordered: true, start: 3, loose: false, items }]).blocks[0]).toEqual({
      kind: "list",
      ordered: true,
      start: 3,
      loose: false,
      items: [
        [{ kind: "paragraph", content: [{ kind: "text", text: "three" }] }],
        [{ kind: "paragraph", content: [{ kind: "text", text: "four" }] }],
      ],
    });
  });

  it("keeps each column's alignment and the cells", () => {
    expect(
      build([
        {
          type: "table",
          align: ["left", null, "right"],
          header: [[text("a")], [text("b")], [text("c")]],
          rows: [[[text("1")], [text("2")], [text("3")]]],
        },
      ]).blocks[0],
    ).toEqual({
      kind: "table",
      align: ["left", null, "right"],
      header: [[{ kind: "text", text: "a" }], [{ kind: "text", text: "b" }], [{ kind: "text", text: "c" }]],
      rows: [[[{ kind: "text", text: "1" }], [{ kind: "text", text: "2" }], [{ kind: "text", text: "3" }]]],
    });
  });
});

describe("assemble — diagrams", () => {
  const figure: Figure = { name: "c3-d0.pdf", svg: "<svg/>", size: { width: 10, height: 20 } };

  it("a placeholder paragraph becomes the drawing it names", () => {
    const chapter = build([{ type: "paragraph", inline: [text("::gb-diagram-0::")] }], {
      diagrams: new Map([[0, figure]]),
    });
    expect(chapter.blocks[0]).toEqual({ kind: "figure", figure });
    expect(chapter.figures).toEqual([figure]);
  });

  it("a placeholder with no drawing passes through as prose", () => {
    expect(build([{ type: "paragraph", inline: [text("::gb-diagram-0::")] }]).blocks[0]).toEqual({
      kind: "paragraph",
      content: [{ kind: "text", text: "::gb-diagram-0::" }],
    });
  });

  it("lists the drawings in fence order", () => {
    const second: Figure = { name: "c3-d1.pdf", svg: "<svg/>", size: null };
    const diagrams = new Map([
      [1, second],
      [0, figure],
    ]);
    expect(build([{ type: "rule" }], { diagrams }).figures).toEqual([second, figure]);
  });
});

describe("assemble — smart typography", () => {
  it("is the walk's, when asked: curly quotes and dashes", () => {
    const nodes: MdNode[] = [{ type: "paragraph", inline: [text('He said "hi" -- then')] }];
    expect(build(nodes, { smartTypography: true }).blocks[0]).toEqual({
      kind: "paragraph",
      content: [{ kind: "text", text: "He said \u201chi\u201d \u2013 then" }],
    });
  });

  it("leaves code, raw HTML and escaped text as written", () => {
    const nodes: MdNode[] = [
      {
        type: "paragraph",
        inline: [
          { type: "code", text: '"x" -- y' },
          text(" "),
          { type: "html", text: "<b>" },
          text(" "),
          { type: "text", text: '"kept"', verbatim: true },
        ],
      },
    ];
    expect(build(nodes, { smartTypography: true }).blocks[0]).toEqual({
      kind: "paragraph",
      content: [
        { kind: "code", text: '"x" -- y' },
        { kind: "text", text: " " },
        { kind: "text", text: "<b>" },
        { kind: "text", text: " " },
        { kind: "text", text: '"kept"' },
      ],
    });
  });

  it("gives a heading the same slug the web id carries", () => {
    const nodes: MdNode[] = [{ type: "heading", depth: 2, inline: [text("A -- B")] }];
    expect(build(nodes, { smartTypography: true }).blocks[0]).toMatchObject({ anchors: ["c3--a--b"] });
  });
});
