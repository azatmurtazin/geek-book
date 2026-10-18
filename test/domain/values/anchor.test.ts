// `slugify`, moved from lib/markdown.ts: the heading-id rule the two editions
// and the linter share.

import { describe, expect, it } from "vitest";
import { slugify } from "../../../src/domain/values/anchor.js";

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

  it("collapses punctuation-only runs", () => {
    expect(slugify("C++")).toBe("c");
    expect(slugify("AT&T")).toBe("att");
  });
});
