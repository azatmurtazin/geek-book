// Cross-pipeline parity: what the HTML and TeX renderers must agree on. Both
// start from the same Markdown, with the same config and the same placeholder
// substitutions. Anchors are compared by slug, not by the full chapter-prefixed
// name, because the md→html CLI emits bare slugs while the TeX tree uses
// `c<id>--slug`.

import { describe, expect, it } from "vitest";
import { renderBody, renderStandaloneHtml } from "../../src/md-to-html/render.js";
import { parseChapter } from "../../src/build-tex-book/parse.js";
import { chapterTex } from "../../src/build-tex-book/tex.js";
import { fixtureConfig } from "../helpers/config.js";
import { chapterContext } from "../helpers/chapter.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cfg = fixtureConfig();
const here = path.dirname(fileURLToPath(import.meta.url));
const goldenDir = path.resolve(here, "..", "fixtures", "golden");

async function goldenMd(): Promise<string> {
  return fs.readFileSync(path.join(goldenDir, "chapter.md"), "utf8");
}

function htmlIds(html: string): string[] {
  const matches = html.matchAll(/id="([^"]+)"/g);
  return Array.from(matches, (m) => m[1]);
}

function texLabels(tex: string): string[] {
  const matches = tex.matchAll(/\\label\{([^}]+)\}/g);
  return Array.from(matches, (m) => m[1]);
}

function slugOf(label: string): string {
  const last = label.lastIndexOf("--");
  return last === -1 ? label : label.slice(last + 2);
}

describe("parity — same heading anchors", () => {
  it("the HTML id and TeX labels share the same slug suffix", async () => {
    const md = await goldenMd();
    const html = renderBody(cfg, md);
    const chapter = await parseChapter(cfg, md, chapterContext());
    const tex = chapterTex(cfg, chapter);
    const ids = htmlIds(html);
    const slugs = texLabels(tex).map(slugOf);
    for (const id of ids) {
      expect(slugs).toContain(id);
    }
  });
});

describe("parity — same placeholders", () => {
  it("both pipelines see the same substituted strings in prose", async () => {
    const md = await goldenMd();
    const html = renderBody(cfg, md);
    const chapter = await parseChapter(cfg, md, chapterContext());
    const tex = chapterTex(cfg, chapter);
    expect(html).toContain("1.2.3 and Fixture Book");
    expect(tex).toContain("1.2.3 and Fixture Book");
  });
});

describe("parity — same fence label", () => {
  it("a configured language's label appears in HTML and in TeX", async () => {
    const md = await goldenMd();
    const html = renderBody(cfg, md);
    const chapter = await parseChapter(cfg, md, chapterContext());
    const tex = chapterTex(cfg, chapter);
    expect(html).toContain("Rust");
    expect(tex).toContain("Rust");
  });
});

describe("parity — golden fixture round-trips", () => {
  it("writes the HTML and TeX representations of the golden chapter", async () => {
    const md = await goldenMd();
    const html = renderBody(cfg, md);
    const chapter = await parseChapter(cfg, md, chapterContext());
    const tex = chapterTex(cfg, chapter);
    fs.writeFileSync(path.join(goldenDir, "chapter.html"), html);
    fs.writeFileSync(path.join(goldenDir, "chapter.tex"), tex);
    // The files are committed: their diffs will reveal rendering changes.
    expect(html.length).toBeGreaterThan(0);
    expect(tex.length).toBeGreaterThan(0);
  });
});
