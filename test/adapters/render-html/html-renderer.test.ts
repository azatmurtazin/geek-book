// The HTML renderer: the document model written as an HTML fragment, with no
// Markdown and no `marked`. The golden chapter pins the bytes the website is
// frozen against; the focused cases pin the pieces the guide does not exercise
// (loose lists, column alignment, the entity rule, a source whose href cannot
// be encoded).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  renderChapterBody,
  renderInline,
  type HtmlContext,
} from "../../../src/adapters/render-html/html-renderer.js";
import { MarkedParser } from "../../../src/adapters/markdown/marked-parser.js";
import { substituteContentPlaceholders } from "../../../src/lib/content-placeholders.js";
import { assemble } from "../../../src/domain/services/assemble.js";
import type { Block, Chapter, ChapterContext } from "../../../src/domain/model/chapter.js";
import type { Inline } from "../../../src/domain/model/inline.js";
import { fixtureConfig } from "../../helpers/config.js";

const cfg = fixtureConfig();

/** A context for a page that links to nothing: hrefs and srcs stay as written. */
const plain: HtmlContext = { code: cfg.code, href: (href) => href, src: (src) => src };

/** A chapter of bare blocks, with no assets. */
function chapter(blocks: Block[]): Chapter {
  return { blocks, figures: [], images: [] };
}

const text = (value: string): Inline => ({ kind: "text", text: value });

describe("renderChapterBody — the golden chapter", () => {
  it("reproduces the committed HTML byte for byte", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const goldenDir = path.resolve(here, "..", "..", "fixtures", "golden");
    const md = fs.readFileSync(path.join(goldenDir, "chapter.md"), "utf8");
    const expected = fs.readFileSync(path.join(goldenDir, "chapter.html"), "utf8");

    const ctx: ChapterContext = { chapterId: 0, relBook: "", idOf: new Map() };
    const nodes = new MarkedParser(false).lex(substituteContentPlaceholders(cfg, md));
    const model = assemble(nodes, ctx, { bookDir: cfg.bookDir });

    // One trailing newline either side, whatever the renderer ended with.
    const norm = (html: string): string => html.replace(/\n*$/, "\n");
    expect(norm(renderChapterBody(model, plain))).toBe(norm(expected));
  });
});

describe("renderChapterBody — headings", () => {
  it("hangs the id on the bare slug, taking the chapter prefix back off", () => {
    const model = chapter([
      { kind: "heading", depth: 1, text: [text("Golden Chapter")], anchors: ["c0", "c0--golden-chapter"] },
      { kind: "heading", depth: 2, text: [text("Section One")], anchors: ["c0--section-one"] },
    ]);
    expect(renderChapterBody(model, plain)).toBe(
      '<h1 id="golden-chapter">Golden Chapter</h1><h2 id="section-one">Section One</h2>',
    );
  });
});

describe("renderChapterBody — lists", () => {
  it("writes a tight item's runs bare, with no <p>", () => {
    const model = chapter([
      {
        kind: "list",
        ordered: false,
        start: 1,
        loose: false,
        items: [[{ kind: "paragraph", content: [text("One")] }], [{ kind: "paragraph", content: [text("Two")] }]],
      },
    ]);
    expect(renderChapterBody(model, plain)).toBe("<ul>\n<li>One</li>\n<li>Two</li>\n</ul>\n");
  });

  it("wraps a loose item's paragraphs and numbers from the start", () => {
    const model = chapter([
      {
        kind: "list",
        ordered: true,
        start: 3,
        loose: true,
        items: [[{ kind: "paragraph", content: [text("Three")] }]],
      },
    ]);
    expect(renderChapterBody(model, plain)).toBe('<ol start="3">\n<li><p>Three</p>\n</li>\n</ol>\n');
  });
});

describe("renderChapterBody — tables, callouts and rules", () => {
  it("writes an aligned table, a header and a body", () => {
    const model = chapter([
      {
        kind: "table",
        align: ["left", "right"],
        header: [[text("A")], [text("B")]],
        rows: [[[text("1")], [text("2")]]],
      },
    ]);
    expect(renderChapterBody(model, plain)).toBe(
      '<table>\n<thead>\n<tr>\n<th align="left">A</th>\n<th align="right">B</th>\n</tr>\n</thead>\n' +
        '<tbody><tr>\n<td align="left">1</td>\n<td align="right">2</td>\n</tr>\n</tbody></table>\n',
    );
  });

  it("writes a callout as a blockquote and a rule as <hr>", () => {
    const model = chapter([
      { kind: "callout", blocks: [{ kind: "paragraph", content: [text("quoted")] }] },
      { kind: "rule" },
    ]);
    expect(renderChapterBody(model, plain)).toBe("<blockquote>\n<p>quoted</p>\n</blockquote>\n<hr>\n");
  });
});

describe("renderInline — escaping and unusable hrefs", () => {
  it("escapes a bare `&` in prose but leaves an entity the source wrote", () => {
    expect(renderInline([text("A & B")], plain)).toBe("A &amp; B");
    expect(renderInline([text("A &amp; B")], plain)).toBe("A &amp; B");
  });

  it("encodes every `&` inside a code span", () => {
    expect(renderInline([{ kind: "code", text: "a &amp; b" }], plain)).toBe("<code>a &amp;amp; b</code>");
  });

  it("drops the <a> when the href cannot be encoded, keeping its text", () => {
    const link: Inline = { kind: "link", href: "\uD800", target: null, content: [text("x")] };
    expect(renderInline([link], plain)).toBe("x");
  });

  it("falls back to an image's alt text when the src cannot be encoded", () => {
    const image: Inline = { kind: "image", src: "\uD800", ref: null, alt: "a bird" };
    expect(renderInline([image], plain)).toBe("a bird");
  });

  it("asks the context where a link and a picture go", () => {
    const ctx: HtmlContext = {
      code: cfg.code,
      href: (href) => `/site/${href}`,
      src: (src) => `/img/${src}`,
    };
    const link: Inline = { kind: "link", href: "a.md#x", target: "c1--x", content: [text("x")] };
    const image: Inline = { kind: "image", src: "a.png", ref: null, alt: "" };
    expect(renderInline([link, image], ctx)).toBe('<a href="/site/a.md#x">x</a><img src="/img/a.png" alt="">');
  });
});
