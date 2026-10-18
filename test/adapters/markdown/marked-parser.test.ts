// The `marked` adapter: Markdown source → the neutral tree.
//
// The tree is what the walk reads (see `domain/services/assemble.ts`), so the
// adapter's job is fidelity: the blocks in order, the inline pieces in order,
// raw `href`/alt, raw HTML passed through, and text a backslash escaped flagged
// so the typographer leaves it as written. It decodes no entities and gives no
// heading an id.

import { describe, expect, it } from "vitest";
import { MarkedParser } from "../../../src/adapters/markdown/marked-parser.js";

const parser = new MarkedParser();

describe("MarkedParser — source to the neutral tree", () => {
  it("keeps a representative chapter's blocks in order", () => {
    const md = [
      "# Title *em*",
      "",
      "A `code` **strong** and *em* and ~~del~~ and a &amp; b.",
      "",
      "> quote",
      "",
      "3. three",
      "4. four",
      "",
      "```Rust",
      "fn main() {}",
      "```",
      "",
      "| a | b |",
      "| :- | -: |",
      "| 1 | 2 |",
      "",
      "---",
      "",
      "![alt](img/x.png)",
      "",
      "[t](#x) and <span>hi</span>",
    ].join("\n");

    expect(parser.lex(md)).toEqual([
      {
        type: "heading",
        depth: 1,
        inline: [{ type: "text", text: "Title " }, { type: "em", children: [{ type: "text", text: "em" }] }],
      },
      {
        type: "paragraph",
        inline: [
          { type: "text", text: "A " },
          { type: "code", text: "code" },
          { type: "text", text: " " },
          { type: "strong", children: [{ type: "text", text: "strong" }] },
          { type: "text", text: " and " },
          { type: "em", children: [{ type: "text", text: "em" }] },
          { type: "text", text: " and " },
          { type: "del", children: [{ type: "text", text: "del" }] },
          { type: "text", text: " and a &amp; b." },
        ],
      },
      { type: "blockquote", children: [{ type: "paragraph", inline: [{ type: "text", text: "quote" }] }] },
      {
        type: "list",
        ordered: true,
        start: 3,
        items: [
          [{ type: "text", inline: [{ type: "text", text: "three" }] }],
          [{ type: "text", inline: [{ type: "text", text: "four" }] }],
        ],
      },
      { type: "code", lang: "Rust", text: "fn main() {}", escaped: false },
      {
        type: "table",
        align: ["left", "right"],
        header: [[{ type: "text", text: "a" }], [{ type: "text", text: "b" }]],
        rows: [[[{ type: "text", text: "1" }], [{ type: "text", text: "2" }]]],
      },
      { type: "rule" },
      { type: "paragraph", inline: [{ type: "image", href: "img/x.png", alt: "alt" }] },
      {
        type: "paragraph",
        inline: [
          { type: "link", href: "#x", children: [{ type: "text", text: "t" }] },
          { type: "text", text: " and " },
          { type: "html", text: "<span>" },
          { type: "text", text: "hi" },
          { type: "html", text: "</span>" },
        ],
      },
    ]);
  });

  it("flags a backslash-escaped character so the typographer leaves it alone", () => {
    expect(parser.lex('A "q" and \\"kept\\".')[0]).toEqual({
      type: "paragraph",
      inline: [
        { type: "text", text: 'A "q" and ' },
        { type: "text", text: '"', verbatim: true },
        { type: "text", text: "kept" },
        { type: "text", text: '"', verbatim: true },
        { type: "text", text: "." },
      ],
    });
  });

  it("keeps a bullet list's start at one", () => {
    expect(parser.lex("- one\n- two")[0]).toMatchObject({ type: "list", ordered: false, start: 1 });
  });

  it("reads a tight list item as a text run, not a paragraph", () => {
    expect(parser.lex("- ![alt](x.png)")[0]).toEqual({
      type: "list",
      ordered: false,
      start: 1,
      items: [[{ type: "text", inline: [{ type: "image", href: "x.png", alt: "alt" }] }]],
    });
  });

  it("carries a fence's language lower-cased for the walk to fold", () => {
    // The adapter keeps the source's case; the walk lower-cases it.
    expect(parser.lex("```Rust\nx;\n```")[0]).toEqual({ type: "code", lang: "Rust", text: "x;", escaped: false });
  });

  it("passes a raw HTML block through as an html node", () => {
    expect(parser.lex("<div>block</div>")).toEqual([{ type: "html", text: "<div>block</div>" }]);
  });

  it("reads a remote image's raw href and alt", () => {
    expect(parser.lex("![a bird](https://example.com/a.png)")[0]).toEqual({
      type: "paragraph",
      inline: [{ type: "image", href: "https://example.com/a.png", alt: "a bird" }],
    });
  });
});
