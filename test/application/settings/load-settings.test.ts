// The pure `loadSettings` use case: raw config JSON in, resolved settings out,
// through an in-memory disk. No file is read here — the `FileConfigSource`
// adapter finds it, this decides what it means.

import { describe, expect, it } from "vitest";
import { FileConfigSource } from "../../../src/adapters/config/file-config-source.js";
import { loadSettings } from "../../../src/application/usecases/load-settings.js";
import { MemoryFileSystem } from "../../helpers/memory-fs.js";

/** The settings a book at `/book` with the given config and package.json gets. */
function settingsOf(config: unknown, pkg: unknown = {}) {
  const fs = new MemoryFileSystem({
    "/book/book.config.json": JSON.stringify(config),
    "/book/package.json": JSON.stringify(pkg),
  });
  return loadSettings(new FileConfigSource(fs, "/book").read());
}

describe("loadSettings", () => {
  it("falls back to the conventional book when the config says nothing", () => {
    const { settings } = settingsOf({});
    expect(settings.title).toBe("Untitled book");
    expect(settings.version).toBe("0.0.0");
    expect(settings.bookDir).toBe("/book/book");
    expect(settings.summary).toBe("/book/book/SUMMARY.md");
    expect(settings.chapters).toBe("/book/book/chapters");
    expect(settings.outputWeb).toBe("/book/build/html");
    expect(settings.outputPdf).toBe("/book/build/book.pdf");
    expect(settings.outputClean).toBe(true);
    expect(settings.languages.has("ts")).toBe(true);
  });

  it("reads title and version, preferring the config over package.json", () => {
    const { settings } = settingsOf({ title: "Configured" }, { name: "Pkg", version: "2.0.0" });
    expect(settings.title).toBe("Configured");
    expect(settings.version).toBe("2.0.0");

    const fromPkg = settingsOf({}, { name: "Pkg", version: "2.0.0" }).settings;
    expect(fromPkg.title).toBe("Pkg");
    expect(fromPkg.version).toBe("2.0.0");
  });

  it("resolves every source and output path against the book root", () => {
    const { settings } = settingsOf({
      bookDir: "src",
      summary: "toc.md",
      output: { web: "dist", pdf: "out/book.pdf" },
    });
    expect(settings.bookDir).toBe("/book/src");
    expect(settings.summary).toBe("/book/toc.md");
    expect(settings.outputWeb).toBe("/book/dist");
    expect(settings.outputPdf).toBe("/book/out/book.pdf");
    // SUMMARY's default follows the chapter directory.
    expect(settings.chapters).toBe("/book/src/chapters");
  });

  it("accepts a book's own fence language alongside the built-in ones", () => {
    const { settings } = settingsOf({ code: { gleam: { label: "Gleam" } } });
    expect(settings.languages.has("ts")).toBe(true);
    expect(settings.languages.has("gleam")).toBe(true);
    expect(settings.code.gleam).toEqual({ label: "Gleam", comment: "" });
  });

  it("degrades a malformed config to the conventional book, reporting nothing", () => {
    const { settings, diagnostics } = settingsOf({ diagrams: { theme: "chartreuse", fontSize: 0 } });
    expect(settings.diagrams).toEqual({ theme: "auto", fontSize: 13 });
    expect(diagnostics).toEqual([]);
  });
});
