// The architectural boundaries, asserted as code.
//
// `.dependency-cruiser.cjs` is the same rule set `just boundaries` (and so
// `just lint`) runs; this test drives it through dependency-cruiser's API so a
// violation fails `just test` too (docs/ARCHITECTURE_REFACTORING_PLAN.md §9.3).
// The refactor is complete, so the rules are errors and the tree must satisfy
// all of them.
//
// Besides "no violations", the third test pins the single-importer properties:
// `marked`, `jsdom` and `mermaid` are reached from exactly the adapter that owns
// them, and the assertion is not vacuous — each list must be non-empty.

import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { cruise, type ICruiseResult, type ICruiseOptions, type IConfiguration } from "dependency-cruiser";

const require = createRequire(import.meta.url);
const config = require("../.dependency-cruiser.cjs") as IConfiguration;

/** The third-party libraries each adapter alone may reach. */
const SINGLE_IMPORTERS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["marked", ["src/adapters/markdown/marked-parser.ts"]],
  ["jsdom", ["src/adapters/diagrams/shims.ts"]],
  ["mermaid", ["src/adapters/diagrams/render.ts", "src/adapters/diagrams/theme.ts"]],
];

/** The slice of dependency-cruiser's module shape these assertions read. */
interface Dependency {
  readonly module?: string;
  readonly resolved?: string;
}
interface Module {
  readonly source: string;
  readonly dependencies?: readonly Dependency[];
}

/** Run the committed rule set over `src`, the same way `just boundaries` does. */
async function doCruise(): Promise<ICruiseResult> {
  const options = {
    ...config.options,
    validate: true,
    ruleSet: { forbidden: config.forbidden ?? [] },
  } as ICruiseOptions;
  const { output } = await cruise(["src"], options);
  return output as ICruiseResult;
}

// One cruise for every assertion in the file: the graph is expensive to build
// and identical between tests.
let cruised: Promise<ICruiseResult> | null = null;
function cruiseSrc(): Promise<ICruiseResult> {
  cruised ??= doCruise();
  return cruised;
}

describe("architecture — boundaries", () => {
  it("enforces every rule", () => {
    expect(config.forbidden?.length).toBeGreaterThan(0);
    for (const rule of config.forbidden ?? []) {
      expect(rule.severity, rule.name).toBe("error");
    }
  });

  it("has no boundary violations", async () => {
    const result = await cruiseSrc();
    const violations = result.summary.violations.map((v) => `${v.rule.name}: ${v.from} → ${v.to}`);
    expect(violations).toEqual([]);
  }, 30_000);

  it("reaches marked, jsdom and mermaid only through their adapters", async () => {
    const result = await cruiseSrc();
    const modules = result.modules as unknown as readonly Module[];

    for (const [name, expected] of SINGLE_IMPORTERS) {
      const importers = [
        ...new Set(
          modules
            .filter((m) => (m.dependencies ?? []).some((d) => d.module === name))
            .map((m) => m.source),
        ),
      ].sort();
      expect(importers, name).toEqual([...expected]);
    }
  }, 30_000);
});
