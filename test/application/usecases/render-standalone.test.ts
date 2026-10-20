// The single-file render, driven against an in-memory disk with a stub renderer:
// the use case reads the source, asks for the page and writes it, creating the
// output's directory. The drawing itself is the renderer's business and is
// covered by test/adapters/web/standalone-page.test.ts.

import { describe, expect, it } from "vitest";
import type { StandaloneRenderer } from "../../../src/application/ports/standalone-renderer.js";
import { renderStandalone } from "../../../src/application/usecases/render-standalone.js";
import { ok } from "../../../src/domain/diagnostics.js";
import { MemoryFileSystem } from "../../helpers/memory-fs.js";

const renderer: StandaloneRenderer = {
  render: async (source) => ok(`<html><body>${source.trim()}</body></html>`),
};

describe("renderStandalone", () => {
  it("writes the rendered page, creating the output's directory", async () => {
    const fs = new MemoryFileSystem({ "/notes.md": "# Notes\n" });
    const result = await renderStandalone({ fs, standalone: renderer }, "/notes.md", "/out/deep/notes.html");

    expect(result.ok).toBe(true);
    expect(fs.readText("/out/deep/notes.html")).toBe("<html><body># Notes</body></html>");
  });

  it("fails, as a diagnostic, when the source is not there", async () => {
    const fs = new MemoryFileSystem();
    const result = await renderStandalone({ fs, standalone: renderer }, "/gone.md", "/gone.html");

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.diagnostics[0].message).toBe("/gone.md: no such file");
    expect(fs.exists("/gone.html")).toBe(false);
  });

  it("passes a renderer failure through untouched", async () => {
    const fs = new MemoryFileSystem({ "/notes.md": "# Notes\n" });
    const broken: StandaloneRenderer = {
      render: async () => ({ ok: false, diagnostics: [{ severity: "error", code: "md/render", message: "bad fence" }] }),
    };
    const result = await renderStandalone({ fs, standalone: broken }, "/notes.md", "/notes.html");

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.diagnostics[0].message).toBe("bad fence");
    expect(fs.exists("/notes.html")).toBe(false);
  });
});
