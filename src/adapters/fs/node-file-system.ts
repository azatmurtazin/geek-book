// The `node:fs` implementation of the FileSystem port — the only module that
// imports `node:fs` on the build's behalf.
//
// It is deliberately thin: no globbing, no caching, no stream handling. A read
// that fails answers `null`, so a caller decides whether an absent file is an
// error (a chapter it must build) or normal (an optional `web.css`).

import fs from "node:fs";
import path from "node:path";
import type { FileSystem } from "../../application/ports/file-system.js";

export class NodeFileSystem implements FileSystem {
  exists(target: string): boolean {
    return fs.existsSync(target);
  }

  readText(target: string): string | null {
    try {
      return fs.readFileSync(target, "utf8");
    } catch {
      return null;
    }
  }

  readBytes(target: string): Uint8Array | null {
    try {
      return new Uint8Array(fs.readFileSync(target));
    } catch {
      return null;
    }
  }

  writeText(target: string, text: string): void {
    fs.writeFileSync(target, text);
  }

  writeBytes(target: string, bytes: Uint8Array): void {
    fs.writeFileSync(target, bytes);
  }

  copy(from: string, to: string): void {
    fs.copyFileSync(from, to);
  }

  makeDirs(target: string): void {
    fs.mkdirSync(target, { recursive: true });
  }

  removeTree(target: string): void {
    fs.rmSync(target, { recursive: true, force: true });
  }

  listFiles(dir: string): string[] {
    return this.entries(dir)
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(dir, entry.name));
  }

  listDirs(dir: string): string[] {
    return this.entries(dir)
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(dir, entry.name));
  }

  /** The entries of `dir`, or none when it cannot be read. */
  private entries(dir: string): fs.Dirent[] {
    try {
      return fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return [];
    }
  }
}
