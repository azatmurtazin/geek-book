// `posix-path.ts` — the domain's path operations. `resolve` is the newest: it
// spells the settings' absolute paths the way `path.resolve` did, without the
// application layer importing `node:path`.

import { describe, expect, it } from "vitest";
import * as posix from "../../../src/domain/values/posix-path.js";

describe("resolve", () => {
  it("hangs a relative value off the base", () => {
    expect(posix.resolve("/a", "b")).toBe("/a/b");
    expect(posix.resolve("/a", "b/c/d")).toBe("/a/b/c/d");
  });

  it("lets an absolute value win", () => {
    expect(posix.resolve("/a", "/b")).toBe("/b");
  });

  it("folds `..`", () => {
    expect(posix.resolve("/a/b", "../c")).toBe("/a/c");
  });

  it("drops a trailing slash, except the root's", () => {
    expect(posix.resolve("/a", "b/")).toBe("/a/b");
    expect(posix.resolve("/", "b")).toBe("/b");
    expect(posix.resolve("/a", ".")).toBe("/a");
  });
});
