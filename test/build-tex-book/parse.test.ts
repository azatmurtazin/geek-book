// The Markdown → tree stage (see src/build-tex-book/ir.ts). `parseChapter` is
// the seam: give it a config, a chapter's Markdown and a context, and it hands
// back the blocks every page is spelled from — decoded text, resolved links,
// registered pictures. The fixture book stands in for a real one; no chapter
// under `book/` is read.

import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseChapter, tokensToIr } from "../../src/build-tex-book/parse.js";
import type {
  Block,
  ChapterContext,
  ImageNode,
  Inline,
  LinkNode,
  ListBlock,
  TableBlock,
} from "../../src/build-tex-book/ir.js";
import { fixtureConfig } from "../helpers/config.js";
import { chapterContext } from "../helpers/chapter.js";

const cfg = fixtureConfig();

/** The blocks a chapter's Markdown parses to. */
async function blocks(source: string, ctx?: ChapterContext): Promise<Block[]> {
  return (await parseChapter(cfg, source, ctx ?? chapterContext())).blocks;
}

describe("parseChapter — headings and their anchors", () => {
  it("a chapter title wears the chapter id and its own slug", async () => {    expect((await blocks("# Hello, World!"))[0]).toEqual({
      kind: "heading",
      depth: 1,
      text: [{ kind: "text", text: "Hello, World!" }],
      anchors: ["c3", "c3--hello-world"],
    });
  });

  it("a section wears the slug alone", async () => {
    expect((await blocks("## Set Up"))[0]).toEqual({
      kind: "heading",
      depth: 2,
      text: [{ kind: "text", text: "Set Up" }],
      anchors: ["c3--set-up"],
    });
  });

  it("keeps deeper heading levels", async () => {
    expect((await blocks("#### Deep"))[0]).toMatchObject({ kind: "heading", depth: 4 });
    expect((await blocks("##### Deepest"))[0]).toMatchObject({ kind: "heading", depth: 5 });
  });
});

describe("parseChapter — prose", () => {
  it("carries inline content in order", async () => {
    expect((await blocks("plain **bold** and *em* and `code`"))[0]).toEqual({
      kind: "paragraph",
      content: [
        { kind: "text", text: "plain " },
        { kind: "strong", content: [{ kind: "text", text: "bold" }] },
        { kind: "text", text: " and " },
        { kind: "em", content: [{ kind: "text", text: "em" }] },
        { kind: "text", text: " and " },
        { kind: "code", text: "code" },
      ],
    });
  });

  it("keeps struck-through text and marks a hard break", async () => {
    expect((await blocks("~~gone~~  \nafter"))[0]).toEqual({
      kind: "paragraph",
      content: [
        { kind: "del", content: [{ kind: "text", text: "gone" }] },
        { kind: "break" },
        { kind: "text", text: "after" },
      ],
    });
  });

  it("decodes the entities the source spells", async () => {
    expect((await blocks("a &amp; b &lt; c"))[0]).toEqual({
      kind: "paragraph",
      content: [{ kind: "text", text: "a & b < c" }],
    });
  });

  it("fills content placeholders before the Markdown is read", async () => {
    expect((await blocks("Version {{ version }} of {{ title }}."))[0]).toEqual({
      kind: "paragraph",
      content: [{ kind: "text", text: "Version 1.2.3 of Fixture Book." }],
    });
  });
});

describe("parseChapter — blocks", () => {
  it("a fence keeps its language (lower-cased) and its code", async () => {
    expect((await blocks("```Rust\nfn main() {}\n```"))[0]).toEqual({
      kind: "code",
      lang: "rust",
      code: "fn main() {}",
    });
  });

  it("a blockquote becomes a callout of blocks", async () => {
    expect((await blocks("> Note this"))[0]).toEqual({
      kind: "callout",
      blocks: [{ kind: "paragraph", content: [{ kind: "text", text: "Note this" }] }],
    });
  });

  it("a thematic break becomes a rule", async () => {
    expect((await blocks("---"))[0]).toEqual({ kind: "rule" });
  });
});

describe("parseChapter — lists", () => {
  it("records whether a list is ordered and where it starts", async () => {
    expect((await blocks("3. three\n4. four"))[0]).toMatchObject({ kind: "list", ordered: true, start: 3 });
    expect((await blocks("1. one\n2. two"))[0]).toMatchObject({ kind: "list", ordered: true, start: 1 });
    expect((await blocks("- one\n- two"))[0]).toMatchObject({ kind: "list", ordered: false, start: 1 });
  });

  it("holds each item as blocks of its own", async () => {
    const list = (await blocks("- one\n- two"))[0] as ListBlock;
    expect(list.items).toEqual([
      [{ kind: "paragraph", content: [{ kind: "text", text: "one" }] }],
      [{ kind: "paragraph", content: [{ kind: "text", text: "two" }] }],
    ]);
  });
});

describe("parseChapter — tables", () => {
  it("records the alignment each column asks for, and the rows", async () => {
    const table = (await blocks("| a | b | c |\n| :-- | :-: | --: |\n| 1 | 2 | 3 |"))[0] as TableBlock;
    expect(table).toEqual({
      kind: "table",
      align: ["left", "center", "right"],
      header: [[{ kind: "text", text: "a" }], [{ kind: "text", text: "b" }], [{ kind: "text", text: "c" }]],
      rows: [[[{ kind: "text", text: "1" }], [{ kind: "text", text: "2" }], [{ kind: "text", text: "3" }]]],
    });
  });

  it("leaves an unasked column's alignment to the target", async () => {
    const table = (await blocks("| a |\n| --- |\n| 1 |"))[0] as TableBlock;
    expect(table.align).toEqual([null]);
  });
});

describe("parseChapter — pictures", () => {
  it("a picture alone in a paragraph becomes an image block, and registers a copy", async () => {
    const chapter = await parseChapter(cfg, "![A bird](images/bird.png)", chapterContext());
    expect(chapter.blocks[0]).toEqual({
      kind: "image",
      ref: { file: path.join(cfg.bookDir, "chapters/01_start/images/bird.png"), name: "c3-i0.png" },
      alt: "A bird",
    });
    expect(chapter.images).toEqual([{ relBook: "chapters/01_start/images/bird.png", name: "c3-i0.png" }]);
  });

  it("a picture among words stays inline", async () => {
    const block = (await blocks("see ![alt](images/a.png) here"))[0];
    expect(block.kind).toBe("paragraph");
    expect((block as { content: Inline[] }).content.map((n) => n.kind)).toEqual(["text", "image", "text"]);
  });

  it("a remote picture has no file — it would have to be fetched", async () => {
    const node = (await blocks("![x](https://example.com/a.png)"))[0] as ImageNode;
    expect(node.ref).toBeNull();
    expect(node.alt).toBe("x");
  });

  it("a scheme nothing fetches falls back to its alt text", async () => {
    const node = (await blocks("![x](data:image/png;base64,AAAA)"))[0] as ImageNode;
    expect(node.ref).toBeNull();
  });
});

describe("parseChapter — where a link points", () => {
  /** The `target` of the one link in `[t](href)`. */
  async function targetOf(href: string, ctx?: ChapterContext): Promise<string | null> {
    const block = (await blocks(`[t](${href})`, ctx))[0] as { content: Inline[] };
    return (block.content[0] as LinkNode).target;
  }

  it("an outside URL is no place in the book", async () => {
    expect(await targetOf("https://example.com/x")).toBeNull();
    expect(await targetOf("mailto:a@b.c")).toBeNull();
  });

  it("a bare anchor names a heading of this chapter", async () => {
    expect(await targetOf("#set-up")).toBe("c3--set-up");
  });

  it("a relative .md path names the chapter it resolves to", async () => {
    expect(await targetOf("03_next.md")).toBe("c4");
    expect(await targetOf("03_next.md#part")).toBe("c4--part");
  });

  it("a path the book does not know is no place in the book", async () => {
    expect(await targetOf("missing.md")).toBeNull();
    expect(await targetOf("../02_run.md")).toBeNull();
    expect(await targetOf("images/a.png")).toBeNull();
    expect(await targetOf("#")).toBeNull();
  });

  it("keeps the href verbatim beside the resolved target", async () => {
    const block = (await blocks("[t](03_next.md#part)"))[0] as { content: Inline[] };
    expect(block.content[0]).toMatchObject({ kind: "link", href: "03_next.md#part", target: "c4--part" });
  });
});

describe("tokensToIr — the pure walk", () => {
  it("is synchronous: a chapter's tree, with no I/O", () => {
    const chapter = tokensToIr(cfg, "# Hello\n\nA paragraph.", chapterContext());
    expect(chapter).not.toBeInstanceOf(Promise);
    expect(chapter.blocks[0]).toMatchObject({ kind: "heading", depth: 1, anchors: ["c3", "c3--hello"] });
  });

  it("agrees with parseChapter on a chapter with nothing to fetch or draw", async () => {
    const md = "# Title\n\n## Sec\n\nA paragraph with ![alt](images/bird.png).\n\n- one\n\n```js\nx;\n```";
    const pure = tokensToIr(cfg, md, chapterContext());
    const wrapped = await parseChapter(cfg, md, chapterContext());
    expect(pure).toEqual(wrapped);
  });
});

describe("parseChapter — smart typography", () => {
  /** A config with the key on; the fixture keeps it off. */
  const smart = { ...cfg, markdown: { ...cfg.markdown, smartTypography: true } };

  it("is off by default, straight and flat", async () => {
    expect((await blocks('He said "hi" -- then'))[0]).toEqual({
      kind: "paragraph",
      content: [{ kind: "text", text: 'He said "hi" -- then' }],
    });
  });

  it("smartens the printed prose too", async () => {
    const chapter = await parseChapter(smart, 'He said "hi" -- then', chapterContext());
    expect(chapter.blocks[0]).toEqual({
      kind: "paragraph",
      content: [{ kind: "text", text: "He said \u201chi\u201d \u2013 then" }],
    });
  });

  it("gives a heading the same slug the web id carries", async () => {
    const chapter = await parseChapter(smart, "## A -- B", chapterContext());
    expect(chapter.blocks[0]).toMatchObject({ kind: "heading", anchors: ["c3--a--b"] });
  });

  it("leaves a code span as written", async () => {
    const chapter = await parseChapter(smart, '`"x" -- y`', chapterContext());
    expect(chapter.blocks[0]).toEqual({
      kind: "paragraph",
      content: [{ kind: "code", text: '"x" -- y' }],
    });
  });
});
