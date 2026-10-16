// Smart typography: the string pass the linter shares and the token walk both
// editions run (see src/lib/smart-typography.ts). The string form is pure; the
// walk is driven with hand-built token lists, the same way markdown.test.ts
// builds its tokens.

import { describe, expect, it } from "vitest";
import type { Token } from "marked";
import { applySmartTypography, smartTypography } from "../../src/lib/smart-typography.js";

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

  it("pairs single quotes as quotes", () => {
    expect(smartTypography("'quoted'")).toBe("\u2018quoted\u2019");
  });

  it("pairs a single quote around a double quote", () => {
    expect(smartTypography("'\"quote\"'")).toBe("\u2018\u201cquote\u201d\u2019");
  });

  it("makes two hyphens an en dash and three an em dash", () => {
    expect(smartTypography("A -- B")).toBe("A \u2013 B");
    expect(smartTypography("A---B")).toBe("A\u2014B");
    expect(smartTypography("1990--2000")).toBe("1990\u20132000");
  });

  it("leaves a single hyphen alone", () => {
    expect(smartTypography("well-known")).toBe("well-known");
    expect(smartTypography("a - b")).toBe("a - b");
  });

  it("steps over an inline code span, so a flag keeps its hyphens", () => {
    expect(smartTypography("the `--config` flag")).toBe("the `--config` flag");
  });

  it("carries the run past a code span", () => {
    // The span's own dashes are kept; the run folds the ones after it.
    expect(smartTypography("`--`--x")).toBe("`--`\u2013x");
  });

  it("leaves an unmatched backtick as written", () => {
    expect(smartTypography("a ` b")).toBe("a ` b");
  });
});

describe("applySmartTypography", () => {
  const text = (body: string): Token => ({ type: "text", raw: body, text: body }) as Token;
  const paragraph = (...tokens: Token[]): Token[] =>
    [{ type: "paragraph", raw: "", text: "", tokens } as unknown as Token];

  /** The inline tokens of a one-paragraph document. */
  const inlines = (tokens: Token[]): Token[] => (tokens[0] as unknown as { tokens: Token[] }).tokens;

  it("smartens text tokens in place", () => {
    const tokens = paragraph(text('a "b" -- c'));
    applySmartTypography(tokens);
    expect((inlines(tokens)[0] as { text: string }).text).toBe("a \u201cb\u201d \u2013 c");
  });

  it("carries the run across emphasis, so a wrapping pair still closes", () => {
    const strong = { type: "strong", raw: "", text: "", tokens: [text("bold")] } as unknown as Token;
    const tokens = paragraph(text('"'), strong, text('"'));
    applySmartTypography(tokens);
    const kids = inlines(tokens);
    expect((kids[0] as { text: string }).text).toBe("\u201c");
    expect((kids[2] as { text: string }).text).toBe("\u201d");
  });

  it("starts a fresh run in each paragraph", () => {
    const tokens = [...paragraph(text('end of one"')), ...paragraph(text('next"'))];
    applySmartTypography(tokens);
    // Without a reset the trailing quote of the first paragraph would open here.
    expect((inlines([tokens[1]])[0] as { text: string }).text).toBe("next\u201d");
  });

  it("leaves code spans and raw HTML as written", () => {
    const code = { type: "codespan", raw: "", text: '"code" -- x' } as unknown as Token;
    const html = { type: "html", raw: "", text: '<span title="x">', pre: false, block: false } as unknown as Token;
    const tokens = paragraph(code, html);
    applySmartTypography(tokens);
    const kids = inlines(tokens);
    expect((kids[0] as { text: string }).text).toBe('"code" -- x');
    expect((kids[1] as { text: string }).text).toBe('<span title="x">');
  });

  it("smartens link text but never its target", () => {
    const link = {
      type: "link",
      raw: "",
      href: 'https://example.com/"a"--b',
      text: 'a "b"',
      tokens: [text('a "b"')],
    } as unknown as Token;
    applySmartTypography(paragraph(link));
    expect(((link as unknown as { tokens: Token[] }).tokens[0] as { text: string }).text).toBe("a \u201cb\u201d");
    expect((link as unknown as { href: string }).href).toBe('https://example.com/"a"--b');
  });

  it("starts a fresh run in each table cell", () => {
    const cell = (body: string) => ({ text: body, tokens: [text(body)], header: false, align: null });
    const table = {
      type: "table",
      raw: "",
      align: [null],
      header: [cell('"h"')],
      rows: [[cell('"a" -- b')]],
    } as unknown as Token;
    applySmartTypography([table]);
    const t = table as unknown as { header: { tokens: Token[] }[]; rows: { tokens: Token[] }[][] };
    expect((t.header[0].tokens[0] as { text: string }).text).toBe("\u201ch\u201d");
    expect((t.rows[0][0].tokens[0] as { text: string }).text).toBe("\u201ca\u201d \u2013 b");
  });

  it("recurses into lists and blockquotes", () => {
    const item = {
      type: "list_item",
      raw: "",
      task: false,
      loose: false,
      text: "",
      tokens: paragraph(text('"a" -- b')),
    } as unknown as Token;
    const list = { type: "list", raw: "", ordered: false, start: "", loose: false, items: [item] } as unknown as Token;
    const quote = { type: "blockquote", raw: "", text: "", tokens: paragraph(text('"c"')) } as unknown as Token;
    applySmartTypography([list, quote]);
    const first = ((item as unknown as { tokens: Token[] }).tokens[0] as unknown as { tokens: Token[] }).tokens[0];
    const second = ((quote as unknown as { tokens: Token[] }).tokens[0] as unknown as { tokens: Token[] }).tokens[0];
    expect((first as { text: string }).text).toBe("\u201ca\u201d \u2013 b");
    expect((second as { text: string }).text).toBe("\u201cc\u201d");
  });
});
