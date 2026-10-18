// `label`, moved from lib/ui-strings.ts: the interface label lookup, now over a
// caller-supplied `strings` map.

import { describe, expect, it } from "vitest";
import { label, UI_DEFAULTS } from "../../../src/domain/values/ui-strings.js";

describe("label", () => {
  it("falls back to the English default", () => {
    expect(label({}, "next")).toBe("Next");
    expect(label({}, "contents")).toBe("Table of Contents");
  });

  it("prefers the book's override", () => {
    expect(label({ next: "Suivant" }, "next")).toBe("Suivant");
  });

  it("keeps every default non-empty and keyed by a UI key", () => {
    for (const [key, value] of Object.entries(UI_DEFAULTS)) {
      expect(value.length, key).toBeGreaterThan(0);
    }
  });
});
