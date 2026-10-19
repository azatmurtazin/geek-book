// Smart typography: the string pass the linter shares. The pure engine and the
// walk over the neutral tree live in domain/values/ and are covered by
// test/domain/values/smart-typography.test.ts; this checks the legacy path the
// linter names still answers.

import { describe, expect, it } from "vitest";
import { smartTypography } from "../../src/lib/smart-typography.js";

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
