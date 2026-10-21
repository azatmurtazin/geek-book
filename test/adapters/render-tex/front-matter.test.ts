// The printed edition's front matter: the optional cover page, title page and
// imprint page that stand before the table of contents. The PDF baseline proves
// the whole document still typesets; these cases pin what each optional piece
// contributes and the order they appear in.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { BookSettings } from "../../../src/application/settings.js";
import { frontMatterTex } from "../../../src/adapters/render-tex/front-matter.js";
import { loadFrom } from "../../helpers/config.js";

const tempDirs: string[] = [];

afterAll(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/** A book with `config`, and optionally a cover image at `build/cover.jpg`. */
function makeBook(config: Record<string, unknown> = {}, withCover = false): { cfg: BookSettings; buildDir: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "geek-book-front-"));
  tempDirs.push(root);
  const buildDir = path.join(root, "build");
  fs.mkdirSync(buildDir, { recursive: true });
  fs.writeFileSync(path.join(root, "book.config.json"), JSON.stringify(config));
  if (withCover) {
    fs.writeFileSync(path.join(buildDir, "cover.jpg"), "not really a jpeg");
  }
  return { cfg: loadFrom(root), buildDir };
}

describe("frontMatterTex", () => {
  it("is just the page style and the contents when nothing optional is set", () => {
    const { cfg, buildDir } = makeBook();
    expect(frontMatterTex(cfg, buildDir)).toBe(
      [
        "\\pagestyle{empty}",
        "\\tableofcontents",
        "\\clearpage",
        "\\pecnumberedplain",
      ].join("\n\n"),
    );
  });

  it("adds a cover page that points into the build directory", () => {
    const { cfg, buildDir } = makeBook({ cover: "build/cover.jpg" }, true);
    const tex = frontMatterTex(cfg, buildDir);
    expect(tex).toContain(
      "\\noindent\\includegraphics[width=\\linewidth,height=\\textheight,keepaspectratio]{./cover.jpg}\n\\clearpage",
    );
  });

  it("leaves the cover out when the file does not exist", () => {
    const { cfg, buildDir } = makeBook({ cover: "build/missing.jpg" });
    expect(frontMatterTex(cfg, buildDir)).not.toContain("includegraphics");
  });

  it("sets the title page with the tagline and author, escaping them", () => {
    const { cfg, buildDir } = makeBook({
      title: "A & B",
      tagline: "the <tag> line",
      author: "Ada_Byron",
      tex: { titlePage: true },
    });
    const tex = frontMatterTex(cfg, buildDir);
    expect(tex).toContain("\\begin{titlepage}");
    expect(tex).toContain("\\end{titlepage}");
    expect(tex).toContain("A \\& B");
    expect(tex).toContain("the <tag> line");
    expect(tex).toContain("Ada\\_Byron");
  });

  it("omits the empty parts of the title page", () => {
    const { cfg, buildDir } = makeBook({ tex: { titlePage: true } });
    const tex = frontMatterTex(cfg, buildDir);
    expect(tex).toContain("\\begin{titlepage}");
    expect(tex).not.toContain("\\vfill");
  });

  it("prints an imprint page for a copyright, an ISBN, or both", () => {
    const { cfg, buildDir } = makeBook({
      tex: { copyright: "© 2026 A & B", isbn: "978-1" },
    });
    const tex = frontMatterTex(cfg, buildDir);
    expect(tex).toContain("© 2026 A \\& B\\par");
    expect(tex).toContain("ISBN 978-1\\par");
    expect(tex).toContain("Set in Literata and JetBrains Mono.\\par");

    const lone = makeBook({ tex: { isbn: "978-2" } });
    const loneTex = frontMatterTex(lone.cfg, lone.buildDir);
    expect(loneTex).toContain("ISBN 978-2\\par");
    expect(loneTex).not.toContain("\\vspace{0.7em}\nISBN");
  });

  it("puts cover, title and imprint before the contents, in that order", () => {
    const { cfg, buildDir } = makeBook({
      cover: "build/cover.jpg",
      tex: { titlePage: true, copyright: "© 2026" },
    }, true);
    const tex = frontMatterTex(cfg, buildDir);
    const cover = tex.indexOf("includegraphics");
    const title = tex.indexOf("\\begin{titlepage}");
    const imprint = tex.indexOf("Set in ");
    const contents = tex.indexOf("\\tableofcontents");
    expect(cover).toBeGreaterThan(-1);
    expect(cover).toBeLessThan(title);
    expect(title).toBeLessThan(imprint);
    expect(imprint).toBeLessThan(contents);
  });
});
