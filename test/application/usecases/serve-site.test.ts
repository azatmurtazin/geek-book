// The preview server's use case, driven against an in-memory disk and a fake
// server: what directory and port it asks for, what address it reports, and the
// failures — a directory that is not there and a socket that will not bind —
// which are diagnostics rather than exceptions.

import { describe, expect, it } from "vitest";
import { FileConfigSource } from "../../../src/adapters/config/file-config-source.js";
import type { SiteListening, SiteServer } from "../../../src/application/ports/site-server.js";
import { loadSettings } from "../../../src/application/usecases/load-settings.js";
import { serveSite } from "../../../src/application/usecases/serve-site.js";
import type { Diagnostic, Result } from "../../../src/domain/diagnostics.js";
import { ok } from "../../../src/domain/diagnostics.js";
import { MemoryFileSystem } from "../../helpers/memory-fs.js";

/** A server that records what it was asked to serve, and reports a bound address. */
class FakeServer implements SiteServer {
  readonly calls: { root: string; port: number }[] = [];
  closed = 0;
  /** A listen failure to return instead of an address. */
  failure: Diagnostic | null = null;
  /** The port to report; defaults to the requested one, as a successful bind does. */
  boundPort: number | null = null;

  async listen(root: string, port: number): Promise<Result<SiteListening>> {
    this.calls.push({ root, port });
    if (this.failure) return { ok: false, diagnostics: [this.failure] };

    const bound = this.boundPort ?? port;
    return ok({
      url: `http://localhost:${bound}`,
      port: bound,
      handle: { close: () => (this.closed += 1) },
    });
  }
}

const CONFIG = { "/book/book.config.json": JSON.stringify({ serve: { port: 4321 } }) };

function setup(seed: Record<string, string> = CONFIG) {
  const fs = new MemoryFileSystem({ ...seed, "/book/build/html/index.html": "<html></html>" });
  const settings = loadSettings(new FileConfigSource(fs, "/book").read()).settings;
  const server = new FakeServer();
  const logged: string[] = [];
  return {
    fs,
    settings,
    server,
    logged,
    deps: { settings, fs, server, logger: { info: (line: string) => logged.push(line) } },
  };
}

describe("serveSite", () => {
  it("serves the website output on the configured port by default", async () => {
    const { deps, server, logged } = setup();
    const result = await serveSite(deps, {});

    expect(result.ok).toBe(true);
    expect(server.calls).toEqual([{ root: "/book/build/html", port: 4321 }]);
    expect(logged).toEqual(["serve: http://localhost:4321 → /book/build/html"]);
  });

  it("resolves a named directory from the book root and takes a named port", async () => {
    const { deps, settings, server } = setup();
    const result = await serveSite(deps, { dir: "build/html", port: 9999 });

    expect(result.ok).toBe(true);
    expect(server.calls).toEqual([{ root: settings.outputWeb, port: 9999 }]);
  });

  it("reports the port the socket actually bound, not the 0 it was asked for", async () => {
    const { deps, server, logged } = setup();
    server.boundPort = 54821;

    const result = await serveSite(deps, { port: 0 });

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.port).toBe(54821);
    expect(result.ok && result.value.url).toBe("http://localhost:54821");
    expect(logged).toEqual(["serve: http://localhost:54821 → /book/build/html"]);
  });

  it("passes a bind failure through without logging a URL", async () => {
    const { deps, server, logged } = setup();
    server.failure = {
      severity: "error",
      code: "serve/address-in-use",
      message: "serve: localhost:4321: address already in use (choose another port)",
    };

    const result = await serveSite(deps, {});

    expect(result.ok).toBe(false);
    expect(!result.ok && result.diagnostics[0].code).toBe("serve/address-in-use");
    expect(logged).toEqual([]);
  });

  it("fails, without starting a server, when the directory is not there", async () => {
    const { deps, server } = setup({ "/book/book.config.json": JSON.stringify({}) });
    const result = await serveSite(deps, { dir: "nowhere" });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.diagnostics[0].message).toBe(
      "serve: /book/nowhere: no such directory (run 'geek-book web' first)",
    );
    expect(server.calls).toEqual([]);
  });
});
