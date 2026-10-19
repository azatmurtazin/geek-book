// The architectural boundaries, asserted as code.
//
// `.dependency-cruiser.cjs` is the same rule set `just boundaries` runs; this
// test drives it through dependency-cruiser's API so a violation fails `just
// test` too (docs/ARCHITECTURE_REFACTORING_PLAN.md §9.3). The rules are
// report-only during the refactor, so the test encodes the two things that can
// be asserted *now*:
//
//   1. the rules that already hold stay clean (domain purity, layering, no node:
//      builtins in the pure layers — vacuously true until those folders exist);
//   2. the `marked` importers are exactly a known allowlist that shrank each
//      phase and is empty from Phase 5: `marked` is reached only through
//      `src/adapters/markdown/`, which the rule allows by path.
//
// When a phase moves a consumer, the allowlist shrinks in the same PR — that
// edit is the record of the progress, and a stray new importer fails here.

import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { cruise, type ICruiseResult, type ICruiseOptions, type IConfiguration } from "dependency-cruiser";

const require = createRequire(import.meta.url);
const config = require("../.dependency-cruiser.cjs") as IConfiguration;

/** Rules that the current tree already satisfies and the refactor must keep. */
const ENFORCED_NOW = [
  "domain-is-pure",
  "application-depends-on-domain-only",
  "adapters-avoid-cli",
  "no-node-builtins-in-domain-or-application",
];

/** The legacy `marked` importers the web path still needs. Empty since Phase 5. */
const MARKED_ALLOWLIST = new Set<string>([]);

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
  it("keeps the rules report-only until the refactor's final phase", () => {
    expect(config.forbidden?.length).toBeGreaterThan(0);
    for (const rule of config.forbidden ?? []) {
      expect(rule.severity, rule.name).toBe("warn");
    }
  });

  it("already satisfies the rules that hold today", async () => {
    const result = await cruiseSrc();
    const violations = result.summary.violations.filter((v) =>
      ENFORCED_NOW.includes(v.rule.name),
    );
    expect(violations.map((v) => `${v.rule.name}: ${v.from} → ${v.to}`)).toEqual([]);
  }, 30_000);

  it("imports marked from exactly the legacy allowlist", async () => {
    const result = await cruiseSrc();
    const importers = new Set(
      result.summary.violations
        .filter((v) => v.rule.name === "marked-only-in-its-adapter")
        .map((v) => v.from),
    );
    expect([...importers].sort()).toEqual([...MARKED_ALLOWLIST].sort());
  }, 30_000);
});
