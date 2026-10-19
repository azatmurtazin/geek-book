// The website build, driven against an in-memory disk: no temp directory, no
// network, no jsdom. The configuration, the SUMMARY, the chapters and the output
// all live in the `MemoryFileSystem`, and the diagram renderer is a stub, so the
// test exercises the use case's orchestration — the plan, the pipeline, the
// links, the copies and the writes — and nothing else.

import { describe, expect, it } from "vitest";
import { FileConfigSource } from "../../../src/adapters/config/file-config-source.js";
import { NoRemoteImages } from "../../../src/adapters/http/remote-image-store.js";
import { MarkedParser } from "../../../src/adapters/markdown/marked-parser.js";
import { AssetTemplateStore } from "../../../src/adapters/templates/asset-template-store.js";
import { HtmlWebsiteRenderer } from "../../../src/adapters/web/html-website-renderer.js";
import { buildWebsite } from "../../../src/application/usecases/build-website.js";
import { loadSettings } from "../../../src/application/usecases/load-settings.js";
import { MemoryFileSystem } from "../../helpers/memory-fs.js";

const BOOK: Record<string, string> = {
  "/book/book.config.json": JSON.stringify({ title: "Test Book", author: "Ada" }),
  "/book/book/SUMMARY.md": "# Summary\n\n- [One](01_one.md)\n- [Two](02_two.md)\n",
  "/book/book/README.md": "# Home page\n",
  "/book/book/01_one.md": "# One\n\nHello *world*.\n",
  "/book/book/02_two.md": "# Two\n\nSee [One](01_one.md#hello).\n",
};

/** Build the book above into `/book/out` and hand back the disk and result. */
async function build(seed: Record<string, string> = BOOK, output = "/book/out") {
  const fs = new MemoryFileSystem(seed);
  const settings = loadSettings(new FileConfigSource(fs, "/book").read()).settings;
  const result = await buildWebsite(
    {
      settings,
      fs,
      templates: new AssetTemplateStore(),
      renderer: new HtmlWebsiteRenderer(),
      markdown: new MarkedParser(false),
      diagrams: { render: async (_source, _id, name) => ({ name, svg: "<svg/>", size: null }) },
      openImages: () => new NoRemoteImages(),
      logger: { info: () => {} },
    },
    output,
  );
  return { fs, result };
}

describe("buildWebsite", () => {
  it("writes the home page and one page per written chapter", async () => {
    const { fs, result } = await build();
    expect(result.ok).toBe(true);
    expect(fs.paths().filter((file) => file.startsWith("/book/out/"))).toEqual([
      "/book/out/01_one.html",
      "/book/out/02_two.html",
      "/book/out/assets/style.css",
      "/book/out/index.html",
    ]);
    expect(fs.readText("/book/out/index.html")).toContain("Home page");
    expect(fs.readText("/book/out/01_one.html")).toContain("Hello <em>world</em>");
  });

  it("rewrites an intra-book link to the built page, keeping the anchor", async () => {
    const { fs } = await build();
    expect(fs.readText("/book/out/02_two.html")).toContain('href="01_one.html#hello"');
  });

  it("skips a chapter SUMMARY lists but the book does not have", async () => {
    const { fs, result } = await build({
      ...BOOK,
      "/book/book/SUMMARY.md": "# Summary\n\n- [One](01_one.md)\n- [Gone](99_gone.md)\n",
    });
    expect(result.ok).toBe(true);
    expect(fs.exists("/book/out/99_gone.html")).toBe(false);
    expect(result.ok && result.value.chapters).toBe(1);
  });

  it("copies a local picture beside the page that uses it", async () => {
    const { fs, result } = await build({
      ...BOOK,
      "/book/book/01_one.md": "# One\n\n![a dot](images/dot.png)\n",
      "/book/book/images/dot.png": "PNG",
    });
    expect(result.ok).toBe(true);
    expect(fs.readText("/book/out/images/dot.png")).toBe("PNG");
    expect(fs.readText("/book/out/01_one.html")).toContain('src="images/dot.png"');
  });

  it("fails, as a diagnostic, when the picture is missing", async () => {
    const { result } = await build({
      ...BOOK,
      "/book/book/01_one.md": "# One\n\n![a dot](images/dot.png)\n",
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.diagnostics[0].message).toBe("missing image book/images/dot.png");
  });

  it("fails, as a diagnostic, when no listed chapter is written", async () => {
    const seed = { ...BOOK };
    delete seed["/book/book/01_one.md"];
    delete seed["/book/book/02_two.md"];
    const { result } = await build(seed);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.diagnostics[0].message).toBe("no written chapters in SUMMARY.md");
  });

  it("redirects the home page when the book has no README", async () => {
    const seed = { ...BOOK };
    delete seed["/book/book/README.md"];
    const { fs, result } = await build(seed);
    expect(result.ok).toBe(true);
    expect(fs.readText("/book/out/index.html")).toContain('content="0;url=01_one.html"');
  });
});
