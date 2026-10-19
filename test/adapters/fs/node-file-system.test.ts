// The `node:fs` FileSystem adapter, exercised on a real temporary directory:
// the read/write/list/copy surface the builders use.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { NodeFileSystem } from "../../../src/adapters/fs/node-file-system.js";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "geek-book-fs-"));
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe("NodeFileSystem", () => {
  const io = new NodeFileSystem();

  it("reads text it wrote, and answers null for what is absent", () => {
    const file = path.join(root, "a.txt");
    io.writeText(file, "hello");
    expect(io.readText(file)).toBe("hello");
    expect(io.readText(path.join(root, "nope.txt"))).toBeNull();
  });

  it("round-trips bytes", () => {
    const file = path.join(root, "a.bin");
    io.writeBytes(file, new Uint8Array([1, 2, 3]));
    expect(io.readBytes(file)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("copies a file", () => {
    io.writeText(path.join(root, "from.txt"), "x");
    io.copy(path.join(root, "from.txt"), path.join(root, "to.txt"));
    expect(io.readText(path.join(root, "to.txt"))).toBe("x");
  });

  it("lists files and directories one level down", () => {
    const dir = path.join(root, "listing");
    io.makeDirs(path.join(dir, "nested"));
    io.writeText(path.join(dir, "one.md"), "");
    io.writeText(path.join(dir, "two.md"), "");
    expect(io.listFiles(dir)).toEqual([path.join(dir, "one.md"), path.join(dir, "two.md")]);
    expect(io.listDirs(dir)).toEqual([path.join(dir, "nested")]);
    expect(io.listFiles(path.join(dir, "absent"))).toEqual([]);
  });

  it("removes a tree, present or not", () => {
    const dir = path.join(root, "gone");
    io.makeDirs(dir);
    io.writeText(path.join(dir, "f.md"), "");
    io.removeTree(dir);
    expect(io.exists(dir)).toBe(false);
    io.removeTree(dir); // absent is not an error
  });
});
