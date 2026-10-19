// The tree → LaTeX stage (see src/build-tex-book/tex.ts). The tests build IR
// blocks directly — that is the seam's point: the serializer never sees
// Markdown, so a test can hand it exactly the shape it wants. Picture sizing
// reads crafted PNG headers under `test/fixtures/images/` (see the format note
// in lib/image-size.ts: only the signature and the IHDR size fields matter).

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { chapterTex, texEscape } from "../../src/build-tex-book/tex.js";
import type { Block, Chapter, Figure, HeadingBlock } from "../../src/build-tex-book/ir.js";
import { fixtureConfig } from "../helpers/config.js";

const cfg = fixtureConfig();

const chapterOf = (...blocks: Block[]): Chapter => ({ blocks, figures: [], images: [] });
/** One chapter's LaTeX, from IR blocks. */
const tex = (...blocks: Block[]): string => chapterTex(cfg, chapterOf(...blocks));

const imagesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "images");

describe("texEscape", () => {
  it("gives each special character its control sequence", () => {
    expect(texEscape("\\")).toBe("\\textbackslash{}");
    expect(texEscape("^")).toBe("\\textasciicircum{}");
    expect(texEscape("~")).toBe("\\textasciitilde{}");
    expect(texEscape("|")).toBe("\\textbar{}");
    for (const ch of "{}#$%&_") expect(texEscape(ch)).toBe(`\\${ch}`);
  });

  it("leaves unicode and ordinary text untouched", () => {
    expect(texEscape("café — 日本語, 42.")).toBe("café — 日本語, 42.");
  });
});

describe("chapterTex — headings", () => {
  it("spells a chapter title as \\chapter, with a label per anchor", () => {
    expect(tex({ kind: "heading", depth: 1, text: [{ kind: "text", text: "Title" }], anchors: ["c3", "c3--title"] })).toBe(
      "\\chapter{Title}\\label{c3}\\label{c3--title}",
    );
  });

  it("maps the deeper levels to their commands", () => {
    for (const [depth, command] of [
      [2, "section"],
      [3, "subsection"],
      [4, "subsubsection"],
      [5, "paragraph"],
    ] as const) {
      expect(tex({ kind: "heading", depth, text: [{ kind: "text", text: "H" }], anchors: ["a"] })).toBe(
        `\\${command}{H}\\label{a}`,
      );
    }
  });

  it("indents a part's TOC entry and sets the running head", () => {
    const title: HeadingBlock = { kind: "heading", depth: 1, text: [{ kind: "text", text: "Part" }], anchors: ["c1"] };
    expect(chapterTex(cfg, chapterOf(title), { tocDepth: 1 })).toBe("\\chapter[\\hspace{1.4em}Part]{Part}\\label{c1}");
    expect(chapterTex(cfg, chapterOf(title), { runningTitle: "One & Only" })).toBe(
      "\\chapter{Part}\\label{c1}\n\\markboth{One \\& Only}{}",
    );
  });

  it("sets a heading's code as plain title code, not a tinted panel", () => {
    expect(tex({ kind: "heading", depth: 2, text: [{ kind: "code", text: "go run" }], anchors: ["a"] })).toBe(
      "\\section{\\texttt{go run}}\\label{a}",
    );
  });
});

describe("chapterTex — prose", () => {
  it("escapes text and sets ordinary code in a panel", () => {
    expect(tex({ kind: "paragraph", content: [{ kind: "text", text: "a & b " }, { kind: "code", text: "x_y" }] })).toBe(
      "a \\& b \\incode{x\\_y}",
    );
  });

  it("sets strong and emphasis, and drops the strike from struck-through text", () => {
    expect(
      tex({
        kind: "paragraph",
        content: [
          { kind: "strong", content: [{ kind: "text", text: "b" }] },
          { kind: "em", content: [{ kind: "text", text: "i" }] },
          { kind: "del", content: [{ kind: "text", text: "gone" }] },
        ],
      }),
    ).toBe("\\textbf{b}\\emph{i}gone");
  });

  it("turns a hard break into a newline", () => {
    expect(
      tex({ kind: "paragraph", content: [{ kind: "text", text: "a" }, { kind: "break" }, { kind: "text", text: "b" }] }),
    ).toBe("a\\newline{}b");
  });
});

describe("chapterTex — links", () => {
  const link = (target: string | null, href: string): Block => ({
    kind: "paragraph",
    content: [{ kind: "link", href, target, content: [{ kind: "text", text: "text" }] }],
  });

  it("names an intra-book target with a hyperref to its label", () => {
    expect(tex(link("c4--part", "03_next.md#part"))).toBe("\\hyperref[c4--part]{\\uplink{text}}");
  });

  it("sends an outside URL through href, keeping % out of TeX's way", () => {
    expect(tex(link(null, "https://example.com/a%20b"))).toBe("\\href{https://example.com/a\\%20b}{\\uplink{text}}");
  });
});

describe("chapterTex — blocks", () => {
  it("a callout wraps its blocks in the callout environment", () => {
    expect(
      tex({ kind: "callout", blocks: [{ kind: "paragraph", content: [{ kind: "text", text: "Note" }] }] }),
    ).toBe("\\begin{callout}\nNote\n\\end{callout}");
  });

  it("a rule is a full-width hairline", () => {
    expect(tex({ kind: "rule" })).toBe(
      "\\par\\medskip\\noindent{\\color{rule}\\rule{\\linewidth}{0.5pt}}\\par\\medskip",
    );
  });
});

describe("chapterTex — code panels", () => {
  it("labels the language and colours comments through \\cc", () => {
    const out = tex({ kind: "code", lang: "rust", code: "// hi\nlet a = 1;" });
    expect(out).toContain("\\begin{codebox}");
    expect(out).toContain("Rust");
    expect(out).toContain("\\cc{// hi}");
    expect(out).toContain("let a = 1;");
    expect(out).toContain("\\end{codebox}");
  });

  it("escapes backslashes and braces a verbatim run still reads", () => {
    expect(tex({ kind: "code", lang: "text", code: "a\\b{c}" })).toContain("a\\textbackslash{}b\\{c\\}");
  });

  it("shows no label line for a language with no chip", () => {
    expect(tex({ kind: "code", lang: "text", code: "plain" })).not.toContain("\\ttfamily");
  });
});

describe("chapterTex — lists", () => {
  const item = (text: string): Block[][] => [[{ kind: "paragraph", content: [{ kind: "text", text }] }]];

  it("bullets use itemize", () => {
    expect(tex({ kind: "list", ordered: false, start: 1, loose: false, items: [...item("one"), ...item("two")] })).toBe(
      "\\begin{itemize}\n\\item one\n\\item two\n\\end{itemize}",
    );
  });

  it("counts an ordered list from where the Markdown says", () => {
    expect(tex({ kind: "list", ordered: true, start: 3, loose: false, items: item("three") })).toBe(
      "\\begin{enumerate}\n\\setcounter{enumi}{2}\n\\item three\n\\end{enumerate}",
    );
  });

  it("a nested list sets the inner counter", () => {
    const inner: Block = { kind: "list", ordered: true, start: 2, loose: false, items: item("b") };
    expect(tex({ kind: "list", ordered: false, start: 1, loose: false, items: [[inner]] })).toContain("\\setcounter{enumii}{1}");
  });
});

describe("chapterTex — tables", () => {
  it("aligns each column and rules every row", () => {
    const out = tex({
      kind: "table",
      align: ["left", "center", null],
      header: [[{ kind: "text", text: "a" }], [{ kind: "text", text: "b" }], [{ kind: "text", text: "c" }]],
      rows: [[[{ kind: "text", text: "1" }], [{ kind: "text", text: "2" }], [{ kind: "text", text: "3" }]]],
    });
    expect(out).toContain("\\begin{tabularx}{\\linewidth}{");
    expect(out).toContain(">{\\raggedright\\arraybackslash}X");
    expect(out).toContain(">{\\centering\\arraybackslash}X");
    expect(out).toContain("1 & 2 & 3 \\\\ \\hline");
    expect(out).toContain("\\color{muted}");
    expect(out).toContain("\\end{tabularx}");
  });
});

describe("chapterTex — pictures", () => {
  const imageBlock = (file: string | null): Block => ({
    kind: "image",
    src: "images/bird.png",
    ref: file === null ? null : { file, name: "c3-i0.png" },
    alt: "A bird",
  });

  it("a picture with no file is its alt text", () => {
    expect(tex(imageBlock(null))).toBe("\\textit{A bird}");
  });

  it("a small picture prints at its own measured size (px → mm)", () => {
    expect(tex(imageBlock(path.join(imagesDir, "small.png")))).toBe(
      "\\begin{center}\n\\includegraphics[width=10.58mm]{figures/c3-i0.png}\n\\end{center}",
    );
  });

  it("a picture wider than the text block shrinks by width", () => {
    expect(tex(imageBlock(path.join(imagesDir, "wide.png")))).toContain(
      "\\includegraphics[width=\\linewidth]{figures/c3-i0.png}",
    );
  });

  it("a picture taller than the text block shrinks by height", () => {
    expect(tex(imageBlock(path.join(imagesDir, "tall.png")))).toContain(
      "\\includegraphics[height=\\textheight]{figures/c3-i0.png}",
    );
  });

  it("a file the size reader cannot measure fills the block", () => {
    expect(tex(imageBlock(path.join(imagesDir, "missing.png")))).toContain(
      "[width=\\linewidth,height=\\textheight,keepaspectratio]",
    );
  });

  it("a picture inside a sentence is not centred", () => {
    expect(
      tex({
        kind: "paragraph",
        content: [
          { kind: "text", text: "a " },
          { kind: "image", src: "images/small.png", ref: { file: path.join(imagesDir, "small.png"), name: "c3-i0.png" }, alt: "x" },
        ],
      }),
    ).toBe("a \\includegraphics[width=10.58mm]{figures/c3-i0.png}");
  });
});

describe("chapterTex — drawings", () => {
  const figure = (size: Figure["size"]): Block => ({ kind: "figure", figure: { name: "c3-d1.pdf", svg: "", size } });

  it("a measured drawing that fits prints at its own size", () => {
    expect(tex(figure({ width: 400, height: 300 }))).toBe(
      "\\begin{center}\n\\includegraphics{figures/c3-d1.pdf}\n\\end{center}",
    );
  });

  it("a drawing too wide shrinks by width", () => {
    expect(tex(figure({ width: 800, height: 600 }))).toContain("\\includegraphics[width=\\linewidth]{figures/c3-d1.pdf}");
  });

  it("an unmeasured drawing is placed unconstrained", () => {
    // No viewBox: its size is taken to equal the text width, so it already
    // "fits" and gets no option — the PDF prints at whatever size it carries.
    expect(tex(figure(null))).toBe("\\begin{center}\n\\includegraphics{figures/c3-d1.pdf}\n\\end{center}");
  });
});
