// `splitLines`, moved from lib/markdown.ts: the newline helper the linter and
// both renderers share. Pure, so it needs no config.

import { describe, expect, it } from "vitest";
import { splitLines } from "../../../src/domain/values/text.js";

describe("splitLines", () => {
  it("splits on newlines without a trailing empty line", () => {
    expect(splitLines("a\nb\n")).toEqual(["a", "b"]);
  });

  it("handles CRLF and a missing final newline", () => {
    expect(splitLines("a\r\nb")).toEqual(["a", "b"]);
  });

  it("keeps interior blank lines", () => {
    expect(splitLines("a\n\nb")).toEqual(["a", "", "b"]);
  });

  it("returns one empty line for empty input", () => {
    expect(splitLines("")).toEqual([""]);
  });
});
