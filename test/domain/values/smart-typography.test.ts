// The pure quote/dash engine and the walk over the neutral tree live here; the
// legacy path is a shim over the string form and is checked by
// test/lib/smart-typography.test.ts.

import { describe, expect, it } from "vitest";
import { applySmartTypography, run, smartTypography } from "../../../src/domain/values/smart-typography.js";
import type { MdInline, MdNode } from "../../../src/domain/model/markdown.js";

describe("smartTypography", () => {
  it("opens and closes a double quote around a phrase", () => {
    expect(smartTypography('He said "hi" then left.')).toBe("He said \u201chi\u201d then left.");
  });

  it("opens after an opening bracket", () => {
    expect(smartTypography('("hi")')).toBe("(\u201chi\u201d)");
  });

  it("reads an apostrophe within a word as a right single quote", () => {
    expect(smartTypography("don't")).toBe("don\u2019t");
    expect(smartTypography("80's")).toBe("80\u2019s");
  });

  it("reads a leading apostrophe before a digit as a decade", () => {
    expect(smartTypography("'90s")).toBe("\u201990s");
  });

  it("makes two hyphens an en dash and three an em dash", () => {
    expect(smartTypography("A -- B")).toBe("A \u2013 B");
    expect(smartTypography("A---B")).toBe("A\u2014B");
  });

  it("steps over an inline code span, so a flag keeps its hyphens", () => {
    expect(smartTypography("the `--config` flag")).toBe("the `--config` flag");
  });

  it("carries the run past a code span", () => {
    expect(smartTypography("`--`--x")).toBe("`--`\u2013x");
  });

  it("leaves an unmatched backtick as written", () => {
    expect(smartTypography("a ` b")).toBe("a ` b");
  });
});

describe("run", () => {
  it("reports the character it ended on, for the next run", () => {
    expect(run("ab", "")).toEqual({ text: "ab", next: "b" });
  });

  it("opens a quote at the start of a run and carries the opening mark", () => {
    expect(run('"x', "")).toEqual({ text: "\u201cx", next: "x" });
  });

  it("reads the incoming character as the context for a leading quote", () => {
    expect(run('"', "word").text).toBe("\u201d");
    expect(run('"', " ").text).toBe("\u201c");
  });
});

describe("applySmartTypography", () => {
  const text = (body: string, verbatim = false): MdInline => ({ type: "text", text: body, verbatim });
  const paragraph = (...inline: MdInline[]): MdNode => ({ type: "paragraph", inline });

  /** The inline run of a paragraph node. */
  const inlines = (node: MdNode): readonly MdInline[] =>
    (node as unknown as { inline: readonly MdInline[] }).inline;

  it("smartens text nodes in place", () => {
    const node = paragraph(text('a "b" -- c'));
    applySmartTypography([node]);
    expect((inlines(node)[0] as { text: string }).text).toBe("a \u201cb\u201d \u2013 c");
  });

  it("carries the run across emphasis, so a wrapping pair still closes", () => {
    const strong: MdInline = { type: "strong", children: [text("bold")] };
    const node = paragraph(text('"'), strong, text('"'));
    applySmartTypography([node]);
    const kids = inlines(node);
    expect((kids[0] as { text: string }).text).toBe("\u201c");
    expect((kids[2] as { text: string }).text).toBe("\u201d");
  });

  it("starts a fresh run in each paragraph", () => {
    const nodes = [paragraph(text('end of one"')), paragraph(text('next"'))];
    applySmartTypography(nodes);
    // Without a reset the trailing quote of the first paragraph would open here.
    expect((inlines(nodes[1])[0] as { text: string }).text).toBe("next\u201d");
  });

  it("leaves code spans and raw HTML as written", () => {
    const node = paragraph({ type: "code", text: '"code" -- x' }, { type: "html", text: '<span title="x">' });
    applySmartTypography([node]);
    const kids = inlines(node);
    expect((kids[0] as { text: string }).text).toBe('"code" -- x');
    expect((kids[1] as { text: string }).text).toBe('<span title="x">');
  });

  it("leaves backslash-escaped text as written", () => {
    const node = paragraph(text('"\\"--x"', true));
    applySmartTypography([node]);
    expect((inlines(node)[0] as { text: string }).text).toBe('"\\"--x"');
  });

  it("smartens link text but never its target", () => {
    const link: MdInline = { type: "link", href: 'https://example.com/"a"--b', children: [text('a "b"')] };
    applySmartTypography([paragraph(link)]);
    expect(((link as { children: readonly MdInline[] }).children[0] as { text: string }).text).toBe("a \u201cb\u201d");
    expect((link as { href: string }).href).toBe('https://example.com/"a"--b');
  });

  it("starts a fresh run in each table cell", () => {
    const table: MdNode = {
      type: "table",
      align: [null],
      header: [[text('"h"')]],
      rows: [[[text('"a" -- b')]]],
    };
    applySmartTypography([table]);
    const t = table as unknown as { header: MdInline[][]; rows: MdInline[][][] };
    expect((t.header[0][0] as { text: string }).text).toBe("\u201ch\u201d");
    expect((t.rows[0][0][0] as { text: string }).text).toBe("\u201ca\u201d \u2013 b");
  });

  it("recurses into lists and blockquotes", () => {
    const item: MdNode = paragraph(text('"a" -- b'));
    const list: MdNode = { type: "list", ordered: false, start: 1, loose: false, items: [[item]] };
    const quote: MdNode = { type: "blockquote", children: [paragraph(text('"c"'))] };
    applySmartTypography([list, quote]);
    const first = (list as unknown as { items: MdNode[][] }).items[0][0];
    const second = (quote as unknown as { children: MdNode[] }).children[0];
    expect((inlines(first)[0] as { text: string }).text).toBe("\u201ca\u201d \u2013 b");
    expect((inlines(second)[0] as { text: string }).text).toBe("\u201cc\u201d");
  });
});
