// The standalone-page adapter: the layout is read and the page drawn, and a
// throw from either becomes the `md/render` diagnostic the `md` command prints.

import { describe, expect, it } from "vitest";
import { AssetTemplateStore } from "../../../src/adapters/templates/asset-template-store.js";
import { LayoutStandaloneRenderer } from "../../../src/adapters/web/standalone-renderer.js";
import type { TemplateStore } from "../../../src/application/ports/template-store.js";
import { fixtureConfig } from "../../helpers/config.js";

const cfg = fixtureConfig();

/** Every method but `layout` answers empty; only the throw matters here. */
const broken: TemplateStore = {
  layout: () => {
    throw new Error("layout unavailable");
  },
  contentCss: () => "",
  siteCss: () => "",
  texPreamble: () => "",
  bookCss: () => "",
  headHtml: () => "",
};

describe("LayoutStandaloneRenderer", () => {
  it("draws the page through the real layout", async () => {
    const result = await new LayoutStandaloneRenderer(cfg, new AssetTemplateStore()).render("# Hello");

    expect(result.ok).toBe(true);
    expect(result.ok === true && result.value).toContain('<h1 id="hello">Hello</h1>');
    expect(result.ok === true && result.value).toContain("<!DOCTYPE html>");
  });

  it("turns a throw into the md/render diagnostic", async () => {
    const result = await new LayoutStandaloneRenderer(cfg, broken).render("# Hello");

    expect(result).toEqual({
      ok: false,
      diagnostics: [{ severity: "error", code: "md/render", message: "layout unavailable" }],
    });
  });
});
