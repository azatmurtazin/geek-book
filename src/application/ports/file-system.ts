// The FileSystem port: the thin seam the builders, the server and the config
// reader reach the disk through.
//
// It mirrors the handful of `node:fs` calls the engine makes and nothing more —
// no globbing, no watchers, no streams. A test drives a whole build against an
// in-memory implementation, and the adapter
// (`adapters/fs/node-file-system.ts`) is the only place that imports `node:fs`.
//
// Bytes cross as `Uint8Array`, never `Buffer`, so the port carries no Node type.

export interface FileSystem {
  /** Whether anything (file or directory) is at `path`. */
  exists(path: string): boolean;
  /** `path`'s text, or `null` when it is absent or unreadable. */
  readText(path: string): string | null;
  /** `path`'s bytes, or `null` when it is absent or unreadable. */
  readBytes(path: string): Uint8Array | null;
  writeText(path: string, text: string): void;
  writeBytes(path: string, bytes: Uint8Array): void;
  /** Copy `from` to `to`, overwriting `to`. */
  copy(from: string, to: string): void;
  /** Create `path` and every missing parent. */
  makeDirs(path: string): void;
  /** Remove `path` and everything under it; absent is not an error. */
  removeTree(path: string): void;
  /** Every file directly inside `dir`, as absolute paths; `[]` when absent. */
  listFiles(dir: string): string[];
  /** Every subdirectory directly inside `dir`, as absolute paths; `[]` when absent. */
  listDirs(dir: string): string[];
}
