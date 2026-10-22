// The FileWatcher port: a long-lived subscription to the book's sources.
//
// `serve --watch` needs to know when a source file changes, but the application
// layer cannot import `node:fs`; this port keeps the platform's watcher at the
// edge. The adapter reports absolute paths, and a use case decides which
// changes matter and how to coalesce a burst into one rebuild.

/** A running watch: closing it releases the platform watchers. */
export interface WatchHandle {
  close(): void;
}

export interface FileWatcher {
  /**
   * Watch `paths` — directories recursively, files through their parent
   * directory so an editor's rename-over-save is still seen — and call
   * `onChange` with the absolute path that changed. Paths that do not exist are
   * ignored; a file created later is seen only through a watched directory.
   */
  watch(paths: readonly string[], onChange: (path: string) => void): WatchHandle;
}
