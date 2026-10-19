// The anchor index: the anchors `assemble` gives a chapter, gathered the one way
// the builders and the linter both ask for them.

import { describe, expect, it } from "vitest";
import type { Block } from "../../../src/domain/model/chapter.js";
import {
  chapterAnchors,
  indexAnchors,
} from "../../../src/domain/services/anchor-index.js";

const heading = (depth: 1 | 2 | 3, anchors: string[]): Block => ({
  kind: "heading",
  depth,
  text: [{ kind: "text", text: `H${depth}` }],
  anchors,
});

describe("chapterAnchors", () => {
  it("gathers every heading's anchors, in nested blocks too", () => {
    const blocks: Block[] = [
      heading(1, ["c0", "c0--title"]),
      heading(2, ["c0--first"]),
      {
        kind: "callout",
        blocks: [heading(3, ["c0--quoted"])],
      },
      {
        kind: "list",
        ordered: false,
        start: 1,
        loose: false,
        items: [[heading(3, ["c0--listed"])]],
      },
    ];

    expect([...chapterAnchors(blocks)].sort()).toEqual([
      "c0",
      "c0--first",
      "c0--listed",
      "c0--quoted",
      "c0--title",
    ]);
  });
});

describe("AnchorIndex", () => {
  const index = indexAnchors([
    {
      relBook: "chapters/a.md",
      id: 0,
      blocks: [heading(1, ["c0", "c0--the-title"]), heading(2, ["c0--a-section"])],
    },
  ]);

  it("accepts a heading anchor by its slug", () => {
    expect(index.hasAnchor("chapters/a.md", "the-title")).toBe(true);
    expect(index.hasAnchor("chapters/a.md", "a-section")).toBe(true);
  });

  it("accepts the chapter's own id, which a chapter link names", () => {
    expect(index.hasAnchor("chapters/a.md", "c0")).toBe(true);
  });

  it("rejects an anchor the chapter does not declare", () => {
    expect(index.hasAnchor("chapters/a.md", "nope")).toBe(false);
  });

  it("rejects any anchor in a chapter it does not know", () => {
    expect(index.hasAnchor("chapters/b.md", "the-title")).toBe(false);
  });
});
