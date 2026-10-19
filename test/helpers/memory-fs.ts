// An in-memory FileSystem for the tests that drive a whole build.
//
// It stores text and bytes under the same absolute-ish keys the real adapter
// uses, so a use case behaves identically against either. Directories are
// implied by the files written into them (plus any `makeDirs` calls).

import path from "node:path";
import type { FileSystem } from "../../src/application/ports/file-system.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class MemoryFileSystem implements FileSystem {
  private readonly files = new Map<string, Uint8Array>();
  private readonly dirs = new Set<string>();

  constructor(seed: Record<string, string | Uint8Array> = {}) {
    for (const [file, contents] of Object.entries(seed)) {
      if (typeof contents === "string") this.writeText(file, contents);
      else this.writeBytes(file, contents);
    }
  }

  exists(target: string): boolean {
    return this.files.has(target) || this.dirs.has(target);
  }

  readText(target: string): string | null {
    const bytes = this.files.get(target);
    return bytes === undefined ? null : decoder.decode(bytes);
  }

  readBytes(target: string): Uint8Array | null {
    return this.files.get(target) ?? null;
  }

  writeText(target: string, text: string): void {
    this.put(target, encoder.encode(text));
  }

  writeBytes(target: string, bytes: Uint8Array): void {
    this.put(target, bytes);
  }

  copy(from: string, to: string): void {
    const bytes = this.files.get(from) ?? new Uint8Array();
    this.put(to, new Uint8Array(bytes));
  }

  makeDirs(target: string): void {
    for (let dir = target; dir !== "" && dir !== "/"; dir = path.dirname(dir)) {
      this.dirs.add(dir);
    }
  }

  removeTree(target: string): void {
    for (const file of [...this.files.keys()]) {
      if (file === target || file.startsWith(`${target}/`)) this.files.delete(file);
    }
    for (const dir of [...this.dirs]) {
      if (dir === target || dir.startsWith(`${target}/`)) this.dirs.delete(dir);
    }
  }

  listFiles(dir: string): string[] {
    return [...this.files.keys()].filter((file) => path.dirname(file) === dir).sort();
  }

  listDirs(dir: string): string[] {
    return [...this.dirs].filter((candidate) => candidate !== dir && path.dirname(candidate) === dir).sort();
  }

  /** Every file written so far, for assertions. */
  paths(): string[] {
    return [...this.files.keys()].sort();
  }

  private put(target: string, bytes: Uint8Array): void {
    this.files.set(target, bytes);
    this.makeDirs(path.dirname(target));
  }
}
