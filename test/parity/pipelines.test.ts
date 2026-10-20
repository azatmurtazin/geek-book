// Cross-pipeline parity: what the HTML and TeX renderers must agree on. Both
// start from the same Markdown, with the same config and the same placeholder
// substitutions. Anchors are compared by slug, not by the full chapter-prefixed
// name, because the md→html CLI emits bare slugs while the TeX tree uses
// `c<id>--slug`.

import { describe, expect, it } from "vitest";
import { renderBody } from "../../src/adapters/web/standalone-page.js";
import { printChapter } from "../helpers/print-chapter.js";
import { chapterTex } from "../../src/adapters/render-tex/tex.js";
import { fixtureConfig } from "../helpers/config.js";
import { chapterContext } from "../helpers/chapter.js";
import type { BookSettings } from "../../src/application/settings.js";
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
    const chapter = await printChapter(cfg, md, chapterContext());
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
    const chapter = await printChapter(cfg, md, chapterContext());
    const tex = chapterTex(cfg, chapter);
    expect(html).toContain("1.2.3 and Fixture Book");
    expect(tex).toContain("1.2.3 and Fixture Book");
  });
});

describe("parity — same fence label", () => {
  it("a configured language's label appears in HTML and in TeX", async () => {
    const md = await goldenMd();
    const html = renderBody(cfg, md);
    const chapter = await printChapter(cfg, md, chapterContext());
    const tex = chapterTex(cfg, chapter);
    expect(html).toContain("Rust");
    expect(tex).toContain("Rust");
  });
});

describe("parity — markdown.breaks is website-only", () => {
  it("leaves the printed edition's single newlines soft", async () => {
    const md = "one line\nwrapped here";
    const broken: BookSettings = { ...cfg, markdown: { ...cfg.markdown, breaks: true } };
    const soft = await printChapter(cfg, md, chapterContext());
    const withBreaks = await printChapter(broken, md, chapterContext());
    expect(chapterTex(broken, withBreaks)).toBe(chapterTex(cfg, soft));
  });
});

describe("parity — golden fixture round-trips", () => {
  /** The fresh rendering of the golden chapter, both targets. */
  async function render(): Promise<{ html: string; tex: string }> {
    const md = await goldenMd();
    const chapter = await printChapter(cfg, md, chapterContext());
    return { html: renderBody(cfg, md), tex: chapterTex(cfg, chapter) };
  }

  /** One trailing newline on both sides, whatever the renderer ended with. */
  const norm = (text: string): string => text.replace(/\n*$/, "\n");

  /**
   * Compare a rendering against its committed copy. A rendering change fails
   * here and shows up as a diff; `GOLDEN_UPDATE=1 npx vitest run test/parity`
   * rewrites the copies after a change was meant.
   */
  function golden(name: string, fresh: string): void {
    const file = path.join(goldenDir, name);
    if (process.env.GOLDEN_UPDATE) {
      fs.writeFileSync(file, norm(fresh));
      return;
    }
    expect(norm(fs.readFileSync(file, "utf8"))).toBe(norm(fresh));
  }

  it("matches the committed HTML rendering", async () => {
    golden("chapter.html", (await render()).html);
  });

  it("matches the committed TeX rendering", async () => {
    golden("chapter.tex", (await render()).tex);
  });
});
