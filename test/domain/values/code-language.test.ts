// The code-language lookups moved from lib/langs.ts + lib/code-meta.ts: now over
// a book's `code` map directly.

import { describe, expect, it } from "vitest";
import {
  codeLabel,
  commentStyle,
  DEFAULT_LANGS,
  type CodeTable,
} from "../../../src/domain/values/code-language.js";

const book: CodeTable = { brainfuck: { label: "Brainfuck", comment: "hash" } };

describe("commentStyle", () => {
  it("reads the built-in tables, lower-casing the tag", () => {
    expect(commentStyle({}, "Rust")).toBe("slash");
    expect(commentStyle({}, "Bash")).toBe("hash");
  });

  it("returns null for a language with no comment syntax", () => {
    expect(commentStyle({}, "text")).toBeNull();
    expect(commentStyle({}, "brainfuck")).toBeNull();
  });

  it("lets the book's own map win", () => {
    expect(commentStyle(book, "brainfuck")).toBe("hash");
    expect(commentStyle({ rust: { label: "Rust", comment: "" } }, "rust")).toBe("slash");
  });
});

describe("codeLabel", () => {
  it("reads the built-in labels, lower-casing the tag", () => {
    expect(codeLabel({}, "Rust")).toBe("Rust");
    expect(codeLabel({}, "js")).toBe("JavaScript");
  });

  it("returns undefined for a language with no chip", () => {
    expect(codeLabel({}, "text")).toBeUndefined();
  });

  it("lets the book's own label win", () => {
    expect(codeLabel(book, "brainfuck")).toBe("Brainfuck");
    expect(codeLabel({ rust: { label: "Ferris", comment: "" } }, "rust")).toBe("Ferris");
  });
});

describe("DEFAULT_LANGS", () => {
  it("accepts every language it lists a comment style or label for", () => {
    for (const lang of ["rust", "bash", "json"]) {
      expect(DEFAULT_LANGS).toContain(lang);
    }
  });
});
