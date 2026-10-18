// The pure quote/dash engine moved from lib/smart-typography.ts. The token walk
// stays at the legacy path and is covered by test/lib/smart-typography.test.ts.

import { describe, expect, it } from "vitest";
import { run, smartTypography } from "../../../src/domain/values/smart-typography.js";

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
