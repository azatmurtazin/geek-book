// `serve --watch`: build the website, preview it, and rebuild on a save.
//
// The initial build is deliberate: a reader who has not run `geek-book web`
// still gets a site. If it fails, the command fails with the build's own
// diagnostics; once it succeeds, the server is bound exactly as plain `serve`
// binds it. From then on the watcher coalesces a burst of filesystem events into
// one rebuild, ignores writes under the output directory (a build must not
// trigger itself), and keeps the server alive while a broken chapter is fixed.
//
// A rebuild reports diagnostics like any other build and leaves the server
// running, so the next save can repair the page. Configuration is read once at
// startup: changing `book.config.json` needs a restart, not a rebuild, because
// the Markdown parser, diagram theme and image limits are adapter state built
// from those settings.

import { fail, ok, type Result } from "../../domain/diagnostics.js";
import { isAbsolute, relative } from "../../domain/values/posix-path.js";
import type { FileWatcher, WatchHandle } from "../ports/file-watcher.js";
import type { Reporter } from "../ports/reporter.js";
import { serveRoot, serveSite, type ServeSite, type ServeSiteDeps, type ServeSiteOptions } from "./serve-site.js";
import type { WebsiteReport } from "./build-website.js";
import type { BookSettings } from "../settings.js";

/** How long a burst of watcher events waits before one rebuild. */
const DEFAULT_DEBOUNCE_MS = 100;

export interface WatchSiteDeps extends ServeSiteDeps {
  readonly watcher: FileWatcher;
  readonly reporter: Reporter;
  /** Build the website into the directory being served. */
  readonly build: (outputDir: string) => Promise<Result<WebsiteReport>>;
}

export interface WatchSiteOptions extends ServeSiteOptions {
  /** Quiet period before a rebuild (default 100 ms). */
  readonly debounceMs?: number;
}

/**
 * Build and serve the website, then rebuild it whenever a source changes.
 * Stops when the returned handle closes.
 */
export async function watchSite(deps: WatchSiteDeps, options: WatchSiteOptions): Promise<Result<ServeSite>> {
  const root = serveRoot(deps.settings, options.dir);
  const built = await deps.build(root);
  if (!built.ok) {
    return built;
  }

  const served = await serveSite(deps, options);
  if (!served.ok) {
    return served;
  }

  let watching: WatchHandle;
  try {
    watching = startWatching(deps, root, Math.max(0, options.debounceMs ?? DEFAULT_DEBOUNCE_MS));
  } catch (error) {
    served.value.handle.close();
    const message = error instanceof Error ? error.message : String(error);
    return fail({
      severity: "error",
      code: "serve/watch-failed",
      message: `serve: cannot watch the book: ${message}`,
    });
  }

  deps.logger.info(
    `watch: ${sourceRoots(deps.settings)
      .map((path) => relative(deps.settings.root, path) || ".")
      .join(", ")} (save to rebuild; Ctrl-C stops)`,
  );

  let closed = false;
  const handle = {
    close: () => {
      if (closed) return;
      closed = true;
      watching.close();
      served.value.handle.close();
    },
  };
  return ok({ ...served.value, handle });
}

/** The directories and files whose changes should rebuild the website. */
function sourceRoots(settings: BookSettings): string[] {
  const roots = new Set<string>([settings.bookDir]);
  const add = (path: string | undefined): void => {
    if (path && !inside(settings.bookDir, path)) roots.add(path);
  };
  add(settings.chapters);
  add(settings.summary);
  add(settings.readme);
  add(settings.web.css);
  add(settings.web.head);
  add(settings.web.favicon);
  return [...roots];
}

/** Whether `target` is `base` or something under it. */
function inside(base: string, target: string): boolean {
  const rel = relative(base, target);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/** Watch the sources and rebuild after a quiet burst. */
function startWatching(deps: WatchSiteDeps, outputDir: string, debounceMs: number): WatchHandle {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let building = false;
  let again = false;
  let closed = false;

  const rebuild = async (): Promise<void> => {
    if (closed) return;
    if (building) {
      again = true;
      return;
    }
    building = true;
    try {
      do {
        again = false;
        let result: Result<WebsiteReport>;
        try {
          result = await deps.build(outputDir);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          deps.reporter.report({
            severity: "error",
            code: "serve/rebuild-failed",
            message: `watch: build failed: ${message}`,
          });
          break;
        }
        if (closed) return;
        if (!result.ok) {
          for (const diagnostic of result.diagnostics) deps.reporter.report(diagnostic);
          deps.logger.info("watch: build failed; fix the source and save again");
        }
      } while (again && !closed);
    } finally {
      building = false;
    }
  };

  const schedule = (): void => {
    if (closed) return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void rebuild();
    }, debounceMs);
  };

  const handle = deps.watcher.watch(sourceRoots(deps.settings), (path) => {
    if (!inside(outputDir, path)) schedule();
  });

  return {
    close: () => {
      closed = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      handle.close();
    },
  };
}
