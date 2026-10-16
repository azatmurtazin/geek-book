// The diagram theme and palette, read without a DOM: `diagramOptions` is what
// `render.ts` hands Mermaid, so its shape is the contract both editions share.

import { describe, expect, it } from "vitest";
import { diagramOptions, themeVariables } from "../../src/diagrams/theme.js";
import type { BookConfig } from "../../src/lib/book-config.js";
import { fixtureConfig } from "../helpers/config.js";

const cfg = fixtureConfig();

/** The fixture with one `diagrams` override. */
function withDiagrams(overrides: Partial<BookConfig["diagrams"]>): BookConfig {
  return { ...cfg, diagrams: { ...cfg.diagrams, ...overrides } };
}

describe("themeVariables", () => {
  it("builds the palette from the book's printed colours", () => {
    const vars = themeVariables(cfg);
    expect(vars.primaryColor).toBe(cfg.tex.colors.codeBackground);
    expect(vars.primaryTextColor).toBe(cfg.tex.colors.codeForeground);
    expect(vars.lineColor).toBe(cfg.tex.colors.muted);
    expect(vars.noteBorderColor).toBe(cfg.tex.colors.calloutBorder);
  });
});

describe("diagramOptions", () => {
  it("defaults to Mermaid's default theme with the derived palette", () => {
    const options = diagramOptions(cfg);
    expect(options.theme).toBe("default");
    expect(options.themeVariables?.primaryColor).toBe(cfg.tex.colors.codeBackground);
    expect(options.themeVariables?.fontSize).toBe("13px");
    expect(options.themeVariables?.fontFamily).toBe(
      "Literata, 'DejaVu Serif', serif",
    );
    expect(options.startOnLoad).toBe(false);
    expect(options.securityLevel).toBe("loose");
    expect(options.flowchart?.htmlLabels).toBe(true);
  });

  it("uses a named theme as it is, without the derived palette", () => {
    const options = diagramOptions(withDiagrams({ theme: "forest" }));
    expect(options.theme).toBe("forest");
    expect(options.themeVariables?.primaryColor).toBeUndefined();
    // The type size and family still follow the book.
    expect(options.themeVariables?.fontSize).toBe("13px");
    expect(options.themeVariables?.fontFamily).toBe(
      "Literata, 'DejaVu Serif', serif",
    );
  });

  it("carries a book's own type size in both modes", () => {
    expect(diagramOptions(withDiagrams({ fontSize: 16 })).themeVariables?.fontSize).toBe("16px");
    expect(
      diagramOptions(withDiagrams({ theme: "dark", fontSize: 16 })).themeVariables?.fontSize,
    ).toBe("16px");
  });
});
