// The `diagrams` block, read the way the CLI reads a real book: `loadFrom` walks a
// config through the lenient readers, so a good value comes through and a bad
// one falls back to the default rather than failing the build.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { loadFrom } from "../../helpers/config.js";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "geek-book-config-"));
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

/** A book directory holding `config` as its `book.config.json`. */
function book(config: unknown): string {
  const dir = fs.mkdtempSync(path.join(root, "book-"));
  fs.writeFileSync(path.join(dir, "book.config.json"), JSON.stringify(config));
  return dir;
}

describe("load — diagrams", () => {
  it("defaults to the derived palette and the engine's type size", () => {
    expect(loadFrom(book({})).diagrams).toEqual({ theme: "auto", fontSize: 13 });
  });

  it("reads a named theme and a type size", () => {
    const cfg = loadFrom(book({ diagrams: { theme: "dark", fontSize: 15 } }));
    expect(cfg.diagrams).toEqual({ theme: "dark", fontSize: 15 });
  });

  it("falls back to the derived palette on an unknown theme", () => {
    expect(loadFrom(book({ diagrams: { theme: "chartreuse" } })).diagrams.theme).toBe("auto");
  });

  it("falls back to the default on a non-positive type size", () => {
    expect(loadFrom(book({ diagrams: { fontSize: 0 } })).diagrams.fontSize).toBe(13);
  });
});

describe("load — images", () => {
  it("defaults to a 30-second fetch capped at 20 MiB", () => {
    expect(loadFrom(book({})).images).toEqual({
      timeout: 30,
      types: {},
      maxBytes: 20 * 1024 * 1024,
    });
  });

  it("reads the timeout, the accepted types and the byte limit", () => {
    const cfg = loadFrom(
      book({ images: { timeout: 5, types: { "image/png": ".png" }, maxBytes: 4096 } }),
    );
    expect(cfg.images).toEqual({ timeout: 5, types: { "image/png": ".png" }, maxBytes: 4096 });
  });

  it("falls back on a fractional or non-positive byte limit", () => {
    expect(loadFrom(book({ images: { maxBytes: 1024.5 } })).images.maxBytes).toBe(20 * 1024 * 1024);
    expect(loadFrom(book({ images: { maxBytes: 0 } })).images.maxBytes).toBe(20 * 1024 * 1024);
  });
});

describe("load — markdown", () => {
  it("defaults both switches off", () => {
    expect(loadFrom(book({})).markdown).toEqual({ smartTypography: false, breaks: false });
  });

  it("reads the two switches", () => {
    const cfg = loadFrom(book({ markdown: { smartTypography: true, breaks: true } }));
    expect(cfg.markdown).toEqual({ smartTypography: true, breaks: true });
  });

  it("falls back to the default on a non-boolean", () => {
    expect(loadFrom(book({ markdown: { breaks: "yes" } })).markdown.breaks).toBe(false);
  });
});

describe("load — web", () => {
  it("defaults pretty URLs off", () => {
    expect(loadFrom(book({})).web.prettyUrls).toBe(false);
  });

  it("reads the switch", () => {
    expect(loadFrom(book({ web: { prettyUrls: true } })).web.prettyUrls).toBe(true);
  });

  it("falls back to the default on a non-boolean", () => {
    expect(loadFrom(book({ web: { prettyUrls: "yes" } })).web.prettyUrls).toBe(false);
  });
});
