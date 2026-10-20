// The link family now checks anchors against the modelled chapters, not a second
// Markdown parse: a link the builder resolves is one lint accepts, and a link no
// heading declares is one lint rejects.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { loadFrom } from "../../helpers/config.js";
import { Reporter } from "../../../src/adapters/lint/reporter.js";
import { anchorIndexOf, checkLinks } from "../../../src/adapters/lint/link-checks.js";
import { fixtureConfig } from "../../helpers/config.js";

const tempDirs: string[] = [];

afterAll(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/** A two-chapter book whose first chapter links into the second. */
function bookWithLink(link: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "geek-book-lint-"));
  tempDirs.push(root);
  fs.mkdirSync(path.join(root, "book", "chapters"), { recursive: true });
  fs.writeFileSync(path.join(root, "book.config.json"), "{}\n");
  fs.writeFileSync(
    path.join(root, "book", "SUMMARY.md"),
    "# Summary\n\n- [One](chapters/one.md)\n- [Two](chapters/two.md)\n",
  );
  fs.writeFileSync(
    path.join(root, "book", "chapters", "one.md"),
    `# One\n\nSee [Two](${link}).\n`,
  );
  fs.writeFileSync(
    path.join(root, "book", "chapters", "two.md"),
    "# Two\n\n## A Section\n",
  );

  const cfg = loadFrom(root);
  const written = [
    path.join(cfg.bookDir, "chapters", "one.md"),
    path.join(cfg.bookDir, "chapters", "two.md"),
  ];
  return { cfg, written };
}

describe("anchor parity — a link the builder resolves", () => {
  const cfg = fixtureConfig("site");
  const written = [
    path.join(cfg.bookDir, "chapters", "01_start.md"),
    path.join(cfg.bookDir, "chapters", "02_more.md"),
  ];

  it("names an anchor the model declares", () => {
    // `01_start.md` links to `02_more.md#more`, where `# More` stands.
    const index = anchorIndexOf(cfg, written);
    expect(index.hasAnchor("chapters/02_more.md", "more")).toBe(true);
  });

  it("passes the check with no findings", () => {
    const index = anchorIndexOf(cfg, written);
    const reporter = new Reporter(cfg.root);
    checkLinks(cfg, reporter, written[0], index, new Set(written));
    expect(reporter.errors).toEqual([]);
    expect(reporter.notes).toEqual([]);
  });
});

describe("checkLinks — anchors over the model", () => {
  it("accepts a link to a heading of another chapter", () => {
    const { cfg, written } = bookWithLink("two.md#a-section");
    const reporter = new Reporter(cfg.root);
    checkLinks(cfg, reporter, written[0], anchorIndexOf(cfg, written), new Set(written));
    expect(reporter.errors).toEqual([]);
  });

  it("rejects an anchor no heading declares", () => {
    const { cfg, written } = bookWithLink("two.md#no-such-anchor");
    const reporter = new Reporter(cfg.root);
    checkLinks(cfg, reporter, written[0], anchorIndexOf(cfg, written), new Set(written));
    expect(reporter.errors).toEqual([
      "book/chapters/one.md:3: anchor #no-such-anchor not found in two.md",
    ]);
  });

  it("reports a link target that does not exist", () => {
    const { cfg, written } = bookWithLink("missing.md");
    const reporter = new Reporter(cfg.root);
    checkLinks(cfg, reporter, written[0], anchorIndexOf(cfg, written), new Set(written));
    expect(reporter.errors).toEqual([
      "book/chapters/one.md:3: link target does not exist: missing.md",
    ]);
  });
});
