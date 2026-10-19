// `posix-path.ts` — the domain's path operations. `resolve` and `relative` are
// the newest: they spell the settings' absolute paths the way `node:path` did,
// without the application layer importing `node:path`.

import path from "node:path";
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

describe("relative", () => {
  it("matches node:path.relative on the shapes the printed config uses", () => {
    const cases: [string, string][] = [
      ["/book", "/book/book"],
      ["/book", "/book/book.config.json"],
      ["/book", "/book"],
      ["/book", "/book/build/html"],
      ["/a/b", "/a/c"],
      ["/a/b", "/x"],
    ];
    for (const [from, to] of cases) {
      expect(posix.relative(from, to), `${from} → ${to}`).toBe(path.relative(from, to));
    }
  });
});
