// The config family: book.config.json against the shipped schema. Every finding
// is a warning — the engine treats each key as optional and falls back — so the
// tests assert warnings, not errors, and that a valid config warns about nothing.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { Reporter } from "../../../src/adapters/lint/reporter.js";
import { checkConfig } from "../../../src/adapters/lint/config-checks.js";
import { fixtureConfig, loadFrom } from "../../helpers/config.js";

const tempDirs: string[] = [];

afterAll(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/** A book whose config file holds `body` verbatim, loaded like the CLI does. */
function lintConfig(body: string): Reporter {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "geek-book-config-"));
  tempDirs.push(root);
  fs.writeFileSync(path.join(root, "book.config.json"), body);
  const cfg = loadFrom(root);
  const reporter = new Reporter(cfg.root);
  checkConfig(cfg, reporter);
  return reporter;
}

describe("checkConfig", () => {
  it("says nothing about a valid config", () => {
    const cfg = fixtureConfig();
    const reporter = new Reporter(cfg.root);
    checkConfig(cfg, reporter);
    expect(reporter.warnings).toEqual([]);
  });

  it("accepts a book with no config file at all", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "geek-book-config-"));
    tempDirs.push(root);
    const cfg = loadFrom(root);
    const reporter = new Reporter(cfg.root);
    checkConfig(cfg, reporter);
    expect(reporter.warnings).toEqual([]);
  });

  it("reports the wrong type, an unknown key and a bad enum value", () => {
    const reporter = lintConfig(JSON.stringify({
      title: 5,
      diagramz: {},
      diagrams: { theme: "sunset" },
    }, null, 2));
    expect(reporter.warnings).toEqual([
      "book.config.json: title: expected string",
      "book.config.json: diagramz: unknown key",
      "book.config.json: diagrams.theme: must be one of auto, default, base, dark, forest, neutral, neo, neo-dark, redux, redux-dark, redux-color, redux-dark-color, null",
    ]);
  });

  it("checks nested maps and their entries", () => {
    const reporter = lintConfig(JSON.stringify({
      strings: { nope: "x" },
      placeholders: { edition: 2 },
      code: { rust: { label: "Rust", comment: "dash" } },
      images: { timeout: 0 },
    }, null, 2));
    expect(reporter.warnings).toEqual([
      "book.config.json: strings.nope: unknown key",
      "book.config.json: placeholders.edition: expected string",
      "book.config.json: code.rust.comment: must be one of slash, hash",
      "book.config.json: images.timeout: must be greater than 0",
    ]);
  });

  it("reports malformed JSON instead of throwing", () => {
    const reporter = lintConfig("{ oops");
    expect(reporter.warnings).toHaveLength(1);
    expect(reporter.warnings[0]).toMatch(/^book\.config\.json: does not parse as JSON: /);
  });
});
