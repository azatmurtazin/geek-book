// `serve --watch`: what it builds first, which sources it watches, how a burst
// becomes one rebuild, and that a broken save leaves the preview running.
//
// The watcher, server and build are fakes, so the test is about the use case's
// orchestration rather than filesystem events or sockets; those adapters have
// their own tests.

import { describe, expect, it } from "vitest";
import { FileConfigSource } from "../../../src/adapters/config/file-config-source.js";
import type { FileWatcher, WatchHandle } from "../../../src/application/ports/file-watcher.js";
import type { SiteListening, SiteServer } from "../../../src/application/ports/site-server.js";
import { loadSettings } from "../../../src/application/usecases/load-settings.js";
import { watchSite } from "../../../src/application/usecases/watch-site.js";
import type { Diagnostic, Result } from "../../../src/domain/diagnostics.js";
import { fail, ok } from "../../../src/domain/diagnostics.js";
import { MemoryFileSystem } from "../../helpers/memory-fs.js";

class FakeServer implements SiteServer {
  readonly calls: { root: string; port: number }[] = [];
  closed = 0;

  async listen(root: string, port: number): Promise<Result<SiteListening>> {
    this.calls.push({ root, port });
    return ok({ url: `http://localhost:${port}`, port, handle: { close: () => (this.closed += 1) } });
  }
}

class FakeWatcher implements FileWatcher {
  paths: string[] = [];
  onChange: ((path: string) => void) | null = null;
  closed = 0;

  watch(paths: readonly string[], onChange: (path: string) => void): WatchHandle {
    this.paths = [...paths];
    this.onChange = onChange;
    return { close: () => (this.closed += 1) };
  }

  change(path: string): void {
    this.onChange?.(path);
  }
}

const CONFIG = {
  "/book/book.config.json": JSON.stringify({ title: "Test Book", web: { css: "theme.css" } }),
};

function setup() {
  const fs = new MemoryFileSystem(CONFIG);
  const settings = loadSettings(new FileConfigSource(fs, "/book").read()).settings;
  const server = new FakeServer();
  const watcher = new FakeWatcher();
  const diagnostics: Diagnostic[] = [];
  const logged: string[] = [];
  const builds: string[] = [];
  let failure: Diagnostic | null = null;

  const deps = {
    settings,
    fs,
    server,
    watcher,
    reporter: { report: (diagnostic: Diagnostic) => diagnostics.push(diagnostic) },
    logger: { info: (line: string) => logged.push(line) },
    build: async (outputDir: string): Promise<Result<{ chapters: number; fetched: number }>> => {
      builds.push(outputDir);
      if (failure) return fail(failure);
      fs.writeText(`${outputDir}/index.html`, "<html></html>");
      return ok({ chapters: 1, fetched: 0 });
    },
  };

  return {
    fs,
    settings,
    server,
    watcher,
    diagnostics,
    logged,
    builds,
    deps,
    setFailure: (diagnostic: Diagnostic | null) => (failure = diagnostic),
  };
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe("watchSite", () => {
  it("builds first, serves the output and watches the sources", async () => {
    const { deps, server, watcher, logged, builds } = setup();
    const result = await watchSite(deps, {});

    expect(result.ok).toBe(true);
    expect(builds).toEqual(["/book/build/html"]);
    expect(server.calls).toEqual([{ root: "/book/build/html", port: 4000 }]);
    expect(watcher.paths).toEqual(["/book/book", "/book/theme.css"]);
    expect(logged.some((line) => line.startsWith("watch: book, theme.css"))).toBe(true);

    result.ok && result.value.handle.close();
    expect(watcher.closed).toBe(1);
    expect(server.closed).toBe(1);
  });

  it("rebuilds after a source changes, and ignores the output directory", async () => {
    const { deps, watcher, builds } = setup();
    const result = await watchSite(deps, { debounceMs: 0 });
    expect(result.ok).toBe(true);

    watcher.change("/book/build/html/index.html");
    await wait(25);
    expect(builds).toHaveLength(1);

    watcher.change("/book/book/chapters/00_index.md");
    await wait(25);
    expect(builds).toEqual(["/book/build/html", "/book/build/html"]);

    result.ok && result.value.handle.close();
  });

  it("coalesces a burst of changes into one rebuild", async () => {
    const { deps, watcher, builds } = setup();
    const result = await watchSite(deps, { debounceMs: 25 });
    expect(result.ok).toBe(true);

    watcher.change("/book/book/chapters/00_index.md");
    watcher.change("/book/book/chapters/00_index.md");
    watcher.change("/book/book/README.md");
    await wait(100);
    expect(builds).toHaveLength(2);

    result.ok && result.value.handle.close();
  });

  it("reports a failed rebuild and keeps the preview running", async () => {
    const { deps, watcher, diagnostics, logged, setFailure } = setup();
    const result = await watchSite(deps, { debounceMs: 0 });
    expect(result.ok).toBe(true);

    setFailure({ severity: "error", code: "web/missing-chapter", message: "cannot read chapter" });
    watcher.change("/book/book/chapters/00_index.md");
    await wait(25);

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["web/missing-chapter"]);
    expect(logged).toContain("watch: build failed; fix the source and save again");
    expect(watcher.closed).toBe(0);

    result.ok && result.value.handle.close();
    expect(watcher.closed).toBe(1);
  });

  it("does not serve or watch when the initial build fails", async () => {
    const { deps, server, watcher, setFailure } = setup();
    setFailure({ severity: "error", code: "web/missing-chapter", message: "cannot read chapter" });

    const result = await watchSite(deps, {});

    expect(result.ok).toBe(false);
    expect(server.calls).toEqual([]);
    expect(watcher.paths).toEqual([]);
  });
});
