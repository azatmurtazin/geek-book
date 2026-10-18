// The diagnostics vocabulary: results carry either a value or the reasons it
// could not be produced. Pure — no stream, no exit code, no clock.

import { describe, expect, it } from "vitest";
import {
  combine,
  fail,
  mapResult,
  ok,
  type Diagnostic,
  type Result,
} from "../../src/domain/diagnostics.js";

const boom: Diagnostic = { severity: "error", code: "test/boom", message: "boom" };
const warn: Diagnostic = { severity: "warning", code: "test/warn", message: "careful" };

describe("ok / fail", () => {
  it("carries a value on success and no diagnostics", () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
  });

  it("carries one diagnostic, plus any others", () => {
    expect(fail(boom)).toEqual({ ok: false, diagnostics: [boom] });
    expect(fail(boom, warn)).toEqual({ ok: false, diagnostics: [boom, warn] });
  });
});

describe("combine", () => {
  it("collects every value when every result succeeded", () => {
    expect(combine([ok("a"), ok("b")])).toEqual({ ok: true, value: ["a", "b"] });
  });

  it("collects every diagnostic when any result failed", () => {
    const results: Result<number>[] = [ok(1), fail(boom), ok(2), fail(warn)];
    expect(combine(results)).toEqual({ ok: false, diagnostics: [boom, warn] });
  });

  it("treats an empty batch as success", () => {
    expect(combine([])).toEqual({ ok: true, value: [] });
  });
});

describe("mapResult", () => {
  it("transforms a success", () => {
    expect(mapResult(ok(2), (n) => n * 3)).toEqual({ ok: true, value: 6 });
  });

  it("passes a failure through untouched", () => {
    const failed: Result<number> = fail(boom);
    expect(mapResult(failed, (n) => n * 3)).toBe(failed);
  });
});
