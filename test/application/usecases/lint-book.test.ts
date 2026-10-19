// The lint run's shape, driven by a stand-in for the checks: which families run,
// in what order, against which shared file list, and how the findings come back.
// The checks themselves are covered by test/adapters/lint/ and by running
// `geek-book lint` over the guide (the lint.txt baseline).

import { describe, expect, it } from "vitest";
import { FileConfigSource } from "../../../src/adapters/config/file-config-source.js";
import { LINT_FAMILIES, type LintChecks, type LintOutput } from "../../../src/application/ports/lint-checks.js";
import { loadSettings } from "../../../src/application/usecases/load-settings.js";
import { lintBook } from "../../../src/application/usecases/lint-book.js";
import { MemoryFileSystem } from "../../helpers/memory-fs.js";

/** Records the calls and reports one finding per family, so order is visible. */
class FakeChecks implements LintChecks {
  readonly calls: string[] = [];

  plan(_settings: unknown, out: LintOutput): string[] {
    this.calls.push("plan");
    out.errors.push("book/SUMMARY.md: missing");
    return ["a.md", "b.md"];
  }

  written(_settings: unknown, planned: readonly string[]): string[] {
    this.calls.push(`written:${planned.join(",")}`);
    return ["/book/a.md", "/book/b.md"];
  }

  summary(): void {
    this.calls.push("summary");
  }

  chapter(_settings: unknown, out: LintOutput, file: string): void {
    this.calls.push(`chapter:${file}`);
    out.errors.push(`${file}: bad heading`);
  }

  links(_settings: unknown, out: LintOutput, written: readonly string[], planned: ReadonlySet<string>): void {
    this.calls.push(`links:${written.length}:${[...planned].sort().join("|")}`);
    out.warnings.push("advisory");
    out.notes.push("remote image, fetched at build time: https://example.test/x.png");
  }

  config(): void {
    this.calls.push("config");
  }
}

function setup() {
  const fs = new MemoryFileSystem({ "/book/book.config.json": JSON.stringify({}) });
  const settings = loadSettings(new FileConfigSource(fs, "/book").read()).settings;
  const checks = new FakeChecks();
  return { checks, deps: { settings, checks } };
}

describe("lintBook", () => {
  it("visits every family in order, over one shared file list", () => {
    const { deps, checks } = setup();
    const report = lintBook(deps, { families: new Set(LINT_FAMILIES) });

    expect(checks.calls).toEqual([
      "plan",
      "written:a.md,b.md",
      "summary",
      "chapter:/book/a.md",
      "chapter:/book/b.md",
      "links:2:/book/book/a.md|/book/book/b.md",
      "config",
    ]);
    expect(report.chapters).toBe(2);
    expect(report.errors).toEqual(["book/SUMMARY.md: missing", "/book/a.md: bad heading", "/book/b.md: bad heading"]);
    expect(report.warnings).toEqual(["advisory"]);
    expect(report.notes).toEqual(["remote image, fetched at build time: https://example.test/x.png"]);
  });

  it("runs only the families it was asked for", () => {
    const { deps, checks } = setup();
    const report = lintBook(deps, { families: new Set(["links"]) });

    expect(checks.calls).toEqual(["plan", "written:a.md,b.md", "links:2:/book/book/a.md|/book/book/b.md"]);
    expect(report.errors).toEqual(["book/SUMMARY.md: missing"]);
    expect(report.warnings).toEqual(["advisory"]);
  });

  it("still counts the chapter files when no file family is asked for", () => {
    const { deps, checks } = setup();
    const report = lintBook(deps, { families: new Set(["config"]) });

    expect(checks.calls).toEqual(["plan", "written:a.md,b.md", "config"]);
    expect(report.chapters).toBe(2);
  });
});
