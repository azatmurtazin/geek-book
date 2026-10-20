// The committed baseline records the guide's version: the version token is
// printed in the book, in the website footer, in `geek-book config` and in the
// standalone Markdown render. Bumping package.json therefore moves frozen
// artifacts, and `just verify` reports it as a baseline diff.
//
// This test says the same thing in one line, from the unit suite, so the
// mismatch fails before a push (and, if it ever gets that far, before the
// release workflow publishes). The fix is always the same: refresh the
// baseline in the pinned image and commit it alongside the bump.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson(relative: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(root, relative), "utf8")) as Record<string, unknown>;
}

describe("the committed baseline", () => {
  it("records the version package.json declares", () => {
    const version = readJson("package.json").version;
    expect(
      readJson("test/baseline/config.json").version,
      [
        `package.json says ${String(version)}, but test/baseline/config.json still records the old version.`,
        "The version token is printed in the guide, so refresh the frozen artifacts:",
        "",
        "  rm -rf build && just docker-baseline",
        "",
        "then commit test/baseline/ with the bump.",
      ].join("\n"),
    ).toBe(version);
  });
});
