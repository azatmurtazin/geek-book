// The shared book plan: which chapters are written, in what order, with what
// ids. Both editions read it, so this is where "c0, c1, …" and the SUMMARY
// labels are fixed; the builders only add their own layer on top.

import { describe, expect, it } from "vitest";
import { FileConfigSource } from "../../../src/adapters/config/file-config-source.js";
import { planBook } from "../../../src/application/usecases/plan-book.js";
import { loadSettings } from "../../../src/application/usecases/load-settings.js";
import { MemoryFileSystem } from "../../helpers/memory-fs.js";

const BOOK: Record<string, string> = {
  "/book/book.config.json": JSON.stringify({}),
  "/book/book/SUMMARY.md": [
    "# Summary",
    "",
    "# Getting started",
    "",
    "- [One](chapters/01_one.md)",
    "  - [One A](chapters/01_one_a.md)",
    "- [Two](chapters/02_two.md)",
    "",
  ].join("\n"),
  "/book/book/chapters/01_one.md": "# One\n",
  "/book/book/chapters/01_one_a.md": "# One A\n",
  "/book/book/chapters/02_two.md": "# Two\n",
};

function settingsFor(seed: Record<string, string>) {
  const fs = new MemoryFileSystem(seed);
  return { fs, settings: loadSettings(new FileConfigSource(fs, "/book").read()).settings };
}

describe("planBook", () => {
  it("numbers the written chapters in reading order, groups included", () => {
    const { fs, settings } = settingsFor(BOOK);
    const planned = planBook(fs, settings);

    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    const { items, chapters, idOf } = planned.value;

    expect(items.map((item) => item.kind)).toEqual(["group", "entry", "entry", "entry"]);
    expect(chapters.map((chapter) => [chapter.id, chapter.relBook, chapter.label])).toEqual([
      [0, "chapters/01_one.md", "One"],
      [1, "chapters/01_one_a.md", "One A"],
      [2, "chapters/02_two.md", "Two"],
    ]);
    expect([...idOf]).toEqual([
      ["chapters/01_one.md", 0],
      ["chapters/01_one_a.md", 1],
      ["chapters/02_two.md", 2],
    ]);
  });

  it("keeps the SUMMARY indentation and resolves each chapter's file", () => {
    const { fs, settings } = settingsFor(BOOK);
    const planned = planBook(fs, settings);
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;

    expect(planned.value.chapters.map((chapter) => chapter.indent)).toEqual([0, 2, 0]);
    expect(planned.value.chapters[1].file).toBe("/book/book/chapters/01_one_a.md");
  });

  it("skips a chapter SUMMARY lists but the book does not have", () => {
    const seed = { ...BOOK };
    delete seed["/book/book/chapters/01_one_a.md"];
    const { fs, settings } = settingsFor(seed);
    const planned = planBook(fs, settings);

    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.value.chapters.map((chapter) => chapter.relBook)).toEqual([
      "chapters/01_one.md",
      "chapters/02_two.md",
    ]);
    // The ids close the gap, so a later anchor is c1, not c2.
    expect(planned.value.idOf.get("chapters/02_two.md")).toBe(1);
  });

  it("fails when the book has no SUMMARY.md", () => {
    const seed = { ...BOOK };
    delete seed["/book/book/SUMMARY.md"];
    const { fs, settings } = settingsFor(seed);
    const planned = planBook(fs, settings);

    expect(planned.ok).toBe(false);
    expect(planned.ok === false && planned.diagnostics[0].message).toBe(
      "no SUMMARY.md at /book/book/SUMMARY.md",
    );
  });

  it("fails when none of the listed chapters is written", () => {
    const seed = { ...BOOK };
    for (const file of ["01_one", "01_one_a", "02_two"]) delete seed[`/book/book/chapters/${file}.md`];
    const { fs, settings } = settingsFor(seed);
    const planned = planBook(fs, settings);

    expect(planned.ok).toBe(false);
    expect(planned.ok === false && planned.diagnostics[0].message).toBe("no written chapters in SUMMARY.md");
  });
});
