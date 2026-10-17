// The web build end to end: the `site` fixture built to a temp directory, under
// both naming schemes. `main` is what the `web` command runs, so these read back
// the output tree and the hrefs the browser would follow. The fixture's own
// config keeps the default naming; a test overrides `web` to ask for pretty URLs.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { main } from "../../src/build-web-book/cli.js";
import { fixtureConfig } from "../helpers/config.js";
import type { BookConfig } from "../../src/lib/book-config.js";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "geek-book-site-"));
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

const base = fixtureConfig("site");

/** Build the fixture to a fresh directory with `web` overrides, and return it. */
async function build(name: string, web: Partial<BookConfig["web"]> = {}): Promise<string> {
  const cfg: BookConfig = { ...base, web: { ...base.web, ...web } };
  const out = path.join(root, name);
  expect(await main(cfg, [out])).toBe(0);
  return out;
}

function read(out: string, rel: string): string {
  return fs.readFileSync(path.join(out, rel), "utf8");
}

function exists(out: string, rel: string): boolean {
  return fs.existsSync(path.join(out, rel));
}

describe("web build — default naming", () => {
  let out: string;
  beforeAll(async () => {
    out = await build("flat");
  });

  it("writes each chapter as `<name>.html`", () => {
    expect(exists(out, "index.html")).toBe(true);
    expect(exists(out, "chapters/01_start.html")).toBe(true);
    expect(exists(out, "chapters/02_more.html")).toBe(true);
  });

  it("links a chapter to its sibling, keeping the anchor", () => {
    expect(read(out, "chapters/01_start.html")).toContain('href="02_more.html#more"');
  });

  it("links the home page to a chapter", () => {
    expect(read(out, "index.html")).toContain('href="chapters/01_start.html"');
  });

  it("copies the image into the output and points at it", () => {
    expect(exists(out, "images/dot.png")).toBe(true);
    expect(read(out, "chapters/01_start.html")).toContain('src="../images/dot.png"');
  });
});

describe("web build — pretty URLs", () => {
  let out: string;
  beforeAll(async () => {
    out = await build("pretty", { prettyUrls: true, baseUrl: "https://example.com/book/" });
  });

  it("writes each chapter as `<name>/index.html`, and no bare `.html`", () => {
    expect(exists(out, "chapters/01_start/index.html")).toBe(true);
    expect(exists(out, "chapters/02_more/index.html")).toBe(true);
    expect(exists(out, "chapters/01_start.html")).toBe(false);
  });

  it("links a chapter to its sibling's directory, keeping the anchor", () => {
    expect(read(out, "chapters/01_start/index.html")).toContain('href="../02_more/#more"');
  });

  it("links the home page to a chapter's directory", () => {
    expect(read(out, "index.html")).toContain('href="chapters/01_start/"');
  });

  it("points an image back up to the output root", () => {
    expect(read(out, "chapters/01_start/index.html")).toContain('src="../../images/dot.png"');
  });

  it("writes a chapter's canonical address as its directory", () => {
    expect(read(out, "chapters/01_start/index.html")).toContain(
      '<link rel="canonical" href="https://example.com/book/chapters/01_start/">',
    );
  });

  it("keeps the home page's canonical at the base", () => {
    expect(read(out, "index.html")).toContain('<link rel="canonical" href="https://example.com/book/">');
  });

  it("links prev/next across the directory tree", () => {
    expect(read(out, "chapters/02_more/index.html")).toContain('href="../01_start/"');
  });
});

describe("web build — pretty URLs without a README", () => {
  it("redirects the home page to the first chapter's directory", async () => {
    const cfg: BookConfig = {
      ...base,
      web: { ...base.web, prettyUrls: true },
      readme: path.join(base.bookDir, "no-such-readme.md"),
    };
    const out = path.join(root, "no-readme");
    expect(await main(cfg, [out])).toBe(0);
    expect(read(out, "index.html")).toContain('content="0;url=chapters/01_start/"');
  });
});
