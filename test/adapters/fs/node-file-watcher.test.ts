// The filesystem watcher, exercised against a real temporary directory.
//
// The use case sees a fake; this file covers the part only the adapter gets
// wrong: recursive directory watches, editors that replace a file by renaming
// over it, and the promise that a missing optional path or a closed handle does
// not throw.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NodeFileWatcher } from "../../../src/adapters/fs/node-file-watcher.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "geek-book-watch-"));
  tempDirs.push(dir);
  return dir;
}

async function waitFor(check: () => boolean, timeoutMs = 2000): Promise<void> {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error("timed out waiting for a filesystem event");
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

describe("NodeFileWatcher", () => {
  it("reports a file written into a watched directory, recursively", async () => {
    const dir = tempDir();
    const chapters = path.join(dir, "chapters");
    fs.mkdirSync(chapters);
    const seen: string[] = [];
    const handle = new NodeFileWatcher().watch([dir], (changed) => seen.push(changed));

    try {
      // `fs.watch` registers with the platform asynchronously; a save a moment
      // later is the case a reader actually produces.
      await new Promise((resolve) => setTimeout(resolve, 50));
      fs.writeFileSync(path.join(chapters, "01_index.md"), "# One\n");
      await waitFor(() => seen.includes(path.join(chapters, "01_index.md")));
    } finally {
      handle.close();
    }
  });

  it("sees a file replaced by an editor's rename", async () => {
    const dir = tempDir();
    const file = path.join(dir, "theme.css");
    const replaced = path.join(dir, "theme.css.tmp");
    fs.writeFileSync(file, "body {}\n");
    const seen: string[] = [];
    const handle = new NodeFileWatcher().watch([file], (changed) => seen.push(changed));

    try {
      await new Promise((resolve) => setTimeout(resolve, 50));
      fs.writeFileSync(replaced, "body { color: red; }\n");
      fs.renameSync(replaced, file);
      await waitFor(() => seen.includes(file));
    } finally {
      handle.close();
    }
  });

  it("ignores a missing optional file and closes cleanly", () => {
    const dir = tempDir();
    const handle = new NodeFileWatcher().watch([path.join(dir, "not-yet.css")], () => {});
    expect(() => handle.close()).not.toThrow();
  });
});
