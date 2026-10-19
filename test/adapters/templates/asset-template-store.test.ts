// The template store: the engine's own assets are read and trimmed, and a book's
// optional files come back empty when it names none.

import { describe, expect, it } from "vitest";
import { AssetTemplateStore } from "../../../src/adapters/templates/asset-template-store.js";

describe("AssetTemplateStore", () => {
  const store = new AssetTemplateStore();

  it("reads the standalone layout with its placeholders intact", () => {
    const layout = store.layout();
    expect(layout).toContain("{{ content }}");
    expect(layout).toContain("{{ content-css }}");
  });

  it("reads the two built-in stylesheets, trimmed", () => {
    const content = store.contentCss();
    const site = store.siteCss();
    expect(content.length).toBeGreaterThan(0);
    expect(site.length).toBeGreaterThan(0);
    expect(content).toBe(content.trim());
  });

  it("reads the LaTeX preamble", () => {
    expect(store.texPreamble()).toContain("\\documentclass");
  });

  it("answers empty for a book that names no stylesheet or head", () => {
    expect(store.bookCss("")).toBe("");
    expect(store.headHtml("")).toBe("");
  });
});
