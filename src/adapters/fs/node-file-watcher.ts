// The `node:fs` implementation of the FileWatcher port.
//
// Directories are watched recursively, which catches new chapters and assets as
// well as edits to existing files. A single file is watched through its parent
// directory: an editor that saves by writing a temporary file and renaming it
// over the original replaces the inode, and a watcher attached to the old inode
// would go silent. The parent sees the rename and reports the file's own path,
// so the use case is not asked to rebuild for a neighbouring file.
//
// Watchers are best-effort: a path that does not exist is skipped, and a
// platform watcher error is not allowed to take the preview down. Closing the
// handle closes every underlying watcher.

import fs from "node:fs";
import path from "node:path";
import type { FileWatcher, WatchHandle } from "../../application/ports/file-watcher.js";

export class NodeFileWatcher implements FileWatcher {
  watch(paths: readonly string[], onChange: (path: string) => void): WatchHandle {
    const watchers: fs.FSWatcher[] = [];
    const filesByParent = new Map<string, Set<string>>();

    for (const target of new Set(paths)) {
      let stat: fs.Stats;
      try {
        stat = fs.statSync(target);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        const watcher = this.watchDirectory(target, true, (_event, filename) => {
          onChange(filename === null ? target : path.resolve(target, filename.toString()));
        });
        if (watcher) watchers.push(watcher);
        continue;
      }

      const parent = path.dirname(target);
      const files = filesByParent.get(parent) ?? new Set<string>();
      files.add(path.resolve(target));
      filesByParent.set(parent, files);
    }

    for (const [parent, files] of filesByParent) {
      const watcher = this.watchDirectory(parent, false, (_event, filename) => {
        if (filename === null) {
          for (const file of files) onChange(file);
          return;
        }
        const changed = path.resolve(parent, filename.toString());
        if (files.has(changed)) onChange(changed);
      });
      if (watcher) watchers.push(watcher);
    }

    return {
      close: () => {
        for (const watcher of watchers) watcher.close();
      },
    };
  }

  /** A watcher, or `null` when the platform refuses this path. */
  private watchDirectory(
    directory: string,
    recursive: boolean,
    listener: (event: fs.WatchEventType, filename: string | Buffer | null) => void,
  ): fs.FSWatcher | null {
    try {
      const watcher = fs.watch(directory, { recursive }, listener);
      // A failure after the watcher was created has no request to fail; the
      // preview keeps serving and the next successful save may recover it.
      watcher.on("error", () => {});
      return watcher;
    } catch {
      return null;
    }
  }
}
