// The preview server's use case, driven against an in-memory disk and a fake
// server: what directory and port it asks for, and the one failure — a directory
// that is not there — which is the usual "you have not built the site yet".

import { describe, expect, it } from "vitest";
import { FileConfigSource } from "../../../src/adapters/config/file-config-source.js";
import type { SiteHandle, SiteServer } from "../../../src/application/ports/site-server.js";
import { loadSettings } from "../../../src/application/usecases/load-settings.js";
import { serveSite } from "../../../src/application/usecases/serve-site.js";
import { MemoryFileSystem } from "../../helpers/memory-fs.js";

/** A server that records what it was asked to serve, and announces its URL. */
class FakeServer implements SiteServer {
  readonly calls: { root: string; port: number }[] = [];
  closed = 0;

  listen(root: string, port: number, onReady: (url: string) => void): SiteHandle {
    this.calls.push({ root, port });
    onReady(`http://localhost:${port}`);
    return { close: () => (this.closed += 1) };
  }
}

const CONFIG = { "/book/book.config.json": JSON.stringify({ serve: { port: 4321 } }) };

function setup(seed: Record<string, string> = CONFIG) {
  const fs = new MemoryFileSystem({ ...seed, "/book/build/html/index.html": "<html></html>" });
  const settings = loadSettings(new FileConfigSource(fs, "/book").read()).settings;
  const server = new FakeServer();
  const logged: string[] = [];
  return { fs, settings, server, logged, deps: { settings, fs, server, logger: { info: (line: string) => logged.push(line) } } };
}

describe("serveSite", () => {
  it("serves the website output on the configured port by default", () => {
    const { deps, server, logged } = setup();
    const result = serveSite(deps, {});

    expect(result.ok).toBe(true);
    expect(server.calls).toEqual([{ root: "/book/build/html", port: 4321 }]);
    expect(logged).toEqual(["serve: http://localhost:4321 → /book/build/html"]);
  });

  it("resolves a named directory from the book root and takes a named port", () => {
    const { deps, settings, server } = setup();
    const result = serveSite(deps, { dir: "build/html", port: 9999 });

    expect(result.ok).toBe(true);
    expect(server.calls).toEqual([{ root: settings.outputWeb, port: 9999 }]);
  });

  it("fails, without starting a server, when the directory is not there", () => {
    const { deps, server } = setup({ "/book/book.config.json": JSON.stringify({}) });
    const result = serveSite(deps, { dir: "nowhere" });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.diagnostics[0].message).toBe(
      "serve: /book/nowhere: no such directory (run 'geek-book web' first)",
    );
    expect(server.calls).toEqual([]);
  });
});
