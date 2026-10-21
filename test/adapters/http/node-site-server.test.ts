// The preview server, driven over a real socket against a temporary site.
//
// The use case is covered with a fake; this file is about the part only the
// adapter can get wrong: how a request becomes a file, what a directory and a
// missing file answer, and what happens to a path that tries to climb out.

import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NodeSiteServer } from "../../../src/adapters/http/node-site-server.js";
import type { SiteHandle } from "../../../src/application/ports/site-server.js";

let base: string;
let handle: SiteHandle;
let url: string;

/** GET a raw request path, bypassing `fetch`'s URL normalization. */
function rawGet(pathname: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const request = http.request(`${url}${pathname}`, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => (body += chunk));
      response.on("end", () => resolve({ status: response.statusCode ?? 0, body }));
    });
    request.on("error", reject);
    request.end();
  });
}

beforeAll(async () => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), "geek-book-site-"));
  const root = path.join(base, "site");
  const sibling = path.join(base, "site-secret");
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  fs.mkdirSync(path.join(root, "empty"), { recursive: true });
  fs.mkdirSync(sibling, { recursive: true });
  fs.writeFileSync(path.join(root, "index.html"), "<h1>home</h1>");
  fs.writeFileSync(path.join(root, "docs", "index.html"), "<h1>docs</h1>");
  fs.writeFileSync(path.join(root, "style.css"), "body {}");
  fs.writeFileSync(path.join(root, "pic.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  fs.writeFileSync(path.join(root, "data.bin"), "raw");
  fs.writeFileSync(path.join(sibling, "secret.txt"), "top secret");

  url = await new Promise<string>((resolve) => {
    handle = new NodeSiteServer().listen(root, 0, resolve);
  });
});

afterAll(() => {
  handle.close();
  fs.rmSync(base, { recursive: true, force: true });
});

describe("NodeSiteServer", () => {
  it("binds port 0 to a real port and serves the home page", async () => {
    expect(url).toMatch(/^http:\/\/localhost:\d+$/);
    expect(url).not.toMatch(/:0$/);

    const response = await fetch(`${url}/`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await response.text()).toBe("<h1>home</h1>");
  });

  it("moves a directory to its trailing slash, keeping the query", async () => {
    const bare = await fetch(`${url}/docs`, { redirect: "manual" });
    expect(bare.status).toBe(301);
    expect(bare.headers.get("location")).toBe("/docs/");

    const withQuery = await fetch(`${url}/docs?x=1`, { redirect: "manual" });
    expect(withQuery.status).toBe(301);
    expect(withQuery.headers.get("location")).toBe("/docs/?x=1");

    const moved = await fetch(`${url}/docs/`);
    expect(moved.status).toBe(200);
    expect(await moved.text()).toBe("<h1>docs</h1>");
  });

  it("answers 404 for a missing file and for a directory without an index", async () => {
    expect((await fetch(`${url}/missing.html`)).status).toBe(404);
    expect((await fetch(`${url}/empty/`)).status).toBe(404);
  });

  it("names the type by extension and falls back to octet-stream", async () => {
    const css = await fetch(`${url}/style.css`);
    expect(css.headers.get("content-type")).toBe("text/css; charset=utf-8");

    const png = await fetch(`${url}/pic.png`);
    expect(png.headers.get("content-type")).toBe("image/png");

    const binary = await fetch(`${url}/data.bin`);
    expect(binary.headers.get("content-type")).toBe("application/octet-stream");
  });

  it("refuses an encoded path that climbs out of the root", async () => {
    // `%2e%2e%2f` survives URL parsing as one segment and decodes to `../`;
    // the sibling's name shares the root's prefix, which a prefix check misses.
    const sibling = await fetch(`${url}/%2e%2e%2fsite-secret/secret.txt`);
    expect(sibling.status).toBe(403);

    const parent = await fetch(`${url}/..%2fsite-secret/secret.txt`);
    expect(parent.status).toBe(403);
  });

  it("answers 400 for a malformed escape and keeps serving", async () => {
    const malformed = await rawGet("/%zz");
    expect(malformed.status).toBe(400);

    const next = await fetch(`${url}/style.css`);
    expect(next.status).toBe(200);
  });
});
