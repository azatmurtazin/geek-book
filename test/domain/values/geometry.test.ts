// The paper table and the text-block math moved from lib/book-config.

import { describe, expect, it } from "vitest";
import { PAPERS, textBlock } from "../../../src/domain/values/geometry.js";

describe("PAPERS", () => {
  it("names the LaTeX paper option for each paper", () => {
    expect(PAPERS.a4.option).toBe("a4paper");
    expect(PAPERS.a5.option).toBe("a5paper");
    expect(PAPERS.letter.option).toBe("letterpaper");
    expect(PAPERS.legal.option).toBe("legalpaper");
  });
});

describe("textBlock", () => {
  it("subtracts the side and vertical margins", () => {
    expect(textBlock("a4", { top: 19, bottom: 19, left: 18, right: 18 })).toEqual({
      textWidthMm: 174,
      textHeightMm: 259,
    });
  });

  it("rounds derived lengths to hundredths", () => {
    expect(textBlock("letter", { top: 19, bottom: 19, left: 18, right: 18 })).toEqual({
      textWidthMm: 179.9,
      textHeightMm: 241.4,
    });
  });

  it("clamps a margin wider than the paper to a hairline", () => {
    expect(textBlock("a4", { top: 19, bottom: 19, left: 200, right: 18 })).toEqual({
      textWidthMm: 1,
      textHeightMm: 259,
    });
  });
});
