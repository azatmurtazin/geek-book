// The mermaid fences of a chapter, taken out of its Markdown. Pure string work,
// so a plain suite: an unterminated fence is left as written (the linter's job),
// and a source with no fence comes back byte-for-byte.

import { describe, expect, it } from "vitest";
import { extractDiagrams } from "../../src/domain/services/extract-diagrams.js";

describe("extractDiagrams — mermaid fences out of the source", () => {
  it("swaps a fence for a placeholder paragraph and keeps its source", () => {
    const { markdown, diagrams } = extractDiagrams("before\n\n```mermaid\nflowchart LR\n```\n\nafter");
    expect(diagrams.get(1)).toBe("flowchart LR");
    expect(diagrams.size).toBe(1);
    expect(markdown).toContain("::gb-diagram-1::");
    expect(markdown).not.toContain("mermaid");
  });

  it("numbers several fences in order", () => {
    const { diagrams } = extractDiagrams("```mermaid\na\n```\n\n```mermaid\nb\n```\n");
    expect([...diagrams.entries()]).toEqual([
      [1, "a"],
      [2, "b"],
    ]);
  });

  it("leaves an unterminated fence as written", () => {
    const { markdown, diagrams } = extractDiagrams("```mermaid\nflowchart LR\n");
    expect(diagrams.size).toBe(0);
    expect(markdown).toBe("```mermaid\nflowchart LR\n");
  });

  it("leaves a source with no fence byte-for-byte", () => {
    const source = "# Title\n\nprose\n";
    expect(extractDiagrams(source).markdown).toBe(source);
  });
});
