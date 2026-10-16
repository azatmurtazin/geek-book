// The shared markdown helpers: the slugifier the renderers and the linter both
// use, and the inline-text flattening next to it. These are pure, so they need
// no book config — they are the seam the two editions and the linter agree on.

import { describe, expect, it } from "vitest";
import type { Token } from "marked";
import { plainText, slugify, splitLines } from "../../src/lib/markdown.js";

describe("slugify", () => {
  it("lower-cases and turns spaces into dashes", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("drops punctuation", () => {
    expect(slugify("Hello, World!")).toBe("hello-world");
  });

  it("strips inline markup before slugging", () => {
    expect(slugify("`code` and *em*")).toBe("code-and-em");
    expect(slugify("[a link](https://example.com)")).toBe("a-link");
  });

  it("keeps letters, digits, underscores and dashes", () => {
    expect(slugify("a_b-c 9")).toBe("a_b-c-9");
  });

  it("keeps non-ASCII letters", () => {
    expect(slugify("Über Café")).toBe("über-café");
  });

  it("documents the punctuation-only collapse (C++ -> c, AT&T -> att)", () => {
    expect(slugify("C++")).toBe("c");
    expect(slugify("AT&T")).toBe("att");
  });
});

describe("plainText", () => {
  it("returns the empty string for no tokens", () => {
    expect(plainText([])).toBe("");
  });

  it("concatenates sibling text", () => {
    const tokens = [{ type: "text", text: "Hello " }, { type: "text", text: "World" }] as Token[];
    expect(plainText(tokens)).toBe("Hello World");
  });

  it("recurses into child tokens", () => {
    const tokens = [{ type: "strong", tokens: [{ type: "text", text: "bold" }] }] as Token[];
    expect(plainText(tokens)).toBe("bold");
  });
});

describe("splitLines", () => {
  it("splits on newlines without a trailing empty line", () => {
    expect(splitLines("a\nb\n")).toEqual(["a", "b"]);
  });

  it("handles CRLF and a missing final newline", () => {
    expect(splitLines("a\r\nb")).toEqual(["a", "b"]);
  });
});
