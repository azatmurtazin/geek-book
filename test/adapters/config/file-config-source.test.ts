// The file-backed ConfigSource: it finds the config beside the working directory
// (or the named file) and hands back the parsed JSON, over an in-memory disk.

import path from "node:path";
import { describe, expect, it } from "vitest";
import { FileConfigSource } from "../../../src/adapters/config/file-config-source.js";
import { MemoryFileSystem } from "../../helpers/memory-fs.js";

describe("FileConfigSource", () => {
  it("reads the conventional config and package.json from the cwd", () => {
    const fs = new MemoryFileSystem({
      "/book/book.config.json": '{ "title": "A Book" }\n',
      "/book/package.json": '{ "version": "1.2.3" }\n',
    });

    const raw = new FileConfigSource(fs, "/book").read();
    expect(raw.root).toBe("/book");
    expect(raw.configFile).toBe(path.join("/book", "book.config.json"));
    expect(raw.value).toEqual({ title: "A Book" });
    expect(raw.packageValue).toEqual({ version: "1.2.3" });
  });

  it("builds the book beside a named config file", () => {
    const fs = new MemoryFileSystem({
      "/elsewhere/other.json": "{}\n",
      "/elsewhere/package.json": "{}\n",
    });

    const raw = new FileConfigSource(fs, "/cwd", "/elsewhere/other.json").read();
    expect(raw.root).toBe("/elsewhere");
    expect(raw.configFile).toBe("/elsewhere/other.json");
  });

  it("answers null rather than throwing when a file is absent or malformed", () => {
    const fs = new MemoryFileSystem({ "/book/book.config.json": "not json\n" });
    const raw = new FileConfigSource(fs, "/book").read();
    expect(raw.value).toBeNull();
    expect(raw.packageValue).toBeNull();
  });
});
