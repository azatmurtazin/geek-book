// The remote-image store: what it fetches, what it names the file, and what it
// refuses. The network is a fake `HttpClient` and the disk is the in-memory
// `FileSystem`, so a fetch is a value and a write is a map entry. The build's
// end-to-end use of it is covered by `just verify` (the guide carries one
// remote image).

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { NoRemoteImages, RemoteImages } from "../../../src/adapters/http/remote-images.js";
import type { HttpClient, HttpResponse } from "../../../src/application/ports/http-client.js";
import type { MdNode } from "../../../src/domain/model/markdown.js";
import { MemoryFileSystem } from "../../helpers/memory-fs.js";

/** A client that answers from a table of URL → response. */
class FakeHttp implements HttpClient {
  readonly asked: string[] = [];
  readonly timeouts: number[] = [];

  constructor(private readonly responses: Map<string, HttpResponse | Error>) {}

  async get(url: string, options: { timeoutMs: number }): Promise<HttpResponse> {
    this.asked.push(url);
    this.timeouts.push(options.timeoutMs);
    const response = this.responses.get(url);
    if (response === undefined) throw new Error("no such host");
    if (response instanceof Error) throw response;
    return response;
  }
}

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function image(contentType: string, body = "PNG"): HttpResponse {
  return { ok: true, status: 200, contentType, body: bytes(body) };
}

/** A paragraph carrying one picture, the shape `collect` walks. */
function picture(url: string): MdNode[] {
  return [{ type: "paragraph", inline: [{ type: "image", href: url, alt: "a picture" }] }];
}

/** `<sha1 of the url>.png`, the name the store writes. */
function nameFor(url: string, ext: string): string {
  return `${createHash("sha1").update(url).digest("hex").slice(0, 12)}${ext}`;
}

describe("RemoteImages", () => {
  it("fetches a picture, names it after its URL and writes it under the directory", async () => {
    const url = "https://example.test/bird.png";
    const http = new FakeHttp(new Map([[url, image("image/png")]]));
    const fs = new MemoryFileSystem();
    const store = new RemoteImages("/book/build/html/images/remote", http, fs);

    await store.collect(picture(url));

    const name = nameFor(url, ".png");
    expect(store.fetched).toBe(1);
    expect(store.nameFor(url)).toBe(name);
    expect(store.fileFor(url)).toBe(`/book/build/html/images/remote/${name}`);
    expect(store.lookup(url)).toEqual({ file: `/book/build/html/images/remote/${name}`, name });
    expect(fs.readText(`/book/build/html/images/remote/${name}`)).toBe("PNG");
  });

  it("names the file after the content type's extension, ignoring its parameters", async () => {
    const url = "https://example.test/photo";
    const http = new FakeHttp(new Map([[url, image("image/jpeg; charset=binary")]]));
    const store = new RemoteImages("/img", http, new MemoryFileSystem());

    await store.collect(picture(url));

    expect(store.nameFor(url)).toBe(nameFor(url, ".jpg"));
  });

  it("fetches a URL once, however many chapters carry it", async () => {
    const url = "https://example.test/bird.png";
    const http = new FakeHttp(new Map([[url, image("image/png")]]));
    const store = new RemoteImages("/img", http, new MemoryFileSystem());

    await store.collect([...picture(url), ...picture(url)]);
    await store.collect(picture(url));

    expect(http.asked).toEqual([url]);
    expect(store.fetched).toBe(1);
  });

  it("falls back to the URL's extension when the host labels nothing", async () => {
    const url = "https://example.test/drawing.svg";
    const http = new FakeHttp(new Map([[url, image("application/octet-stream")]]));
    const store = new RemoteImages("/img", http, new MemoryFileSystem());

    await store.collect(picture(url));

    expect(store.nameFor(url)).toBe(nameFor(url, ".svg"));
  });

  it("passes the configured timeout to the client, in milliseconds", async () => {
    const url = "https://example.test/bird.png";
    const http = new FakeHttp(new Map([[url, image("image/png")]]));
    const store = new RemoteImages("/img", http, new MemoryFileSystem(), { timeout: 5 });

    await store.collect(picture(url));

    expect(http.timeouts).toEqual([5000]);
  });

  it("refuses a format the printed edition cannot embed", async () => {
    const url = "https://example.test/drawing.svg";
    const http = new FakeHttp(new Map([[url, image("image/svg+xml")]]));
    const store = new RemoteImages("/img", http, new MemoryFileSystem(), { print: true });

    await expect(store.collect(picture(url))).rejects.toThrow(
      "the printed edition cannot embed https://example.test/drawing.svg (image/svg+xml); it reads png and jpeg",
    );
  });

  it("refuses a response that is not a picture", async () => {
    const url = "https://example.test/page";
    const http = new FakeHttp(new Map([[url, image("text/html")]]));
    const store = new RemoteImages("/img", http, new MemoryFileSystem());

    await expect(store.collect(picture(url))).rejects.toThrow(
      "not an image: https://example.test/page (served text/html)",
    );
  });

  it("names the URL when a fetch fails", async () => {
    const url = "https://example.test/gone.png";
    const http = new FakeHttp(new Map([[url, image("image/png")]]));
    http.get = async () => {
      throw new Error("getaddrinfo ENOTFOUND");
    };
    const store = new RemoteImages("/img", http, new MemoryFileSystem());

    await expect(store.collect(picture(url))).rejects.toThrow(
      "cannot fetch image https://example.test/gone.png: getaddrinfo ENOTFOUND",
    );
  });

  it("reports a non-2xx answer with its status", async () => {
    const url = "https://example.test/missing.png";
    const http = new FakeHttp(new Map([[url, { ok: false, status: 404, contentType: "", body: bytes("") }]]));
    const store = new RemoteImages("/img", http, new MemoryFileSystem());

    await expect(store.collect(picture(url))).rejects.toThrow(
      "cannot fetch image https://example.test/missing.png: HTTP 404",
    );
  });

  it("leaves a picture alone when it is a code sample", async () => {
    const http = new FakeHttp(new Map());
    const store = new RemoteImages("/img", http, new MemoryFileSystem());
    const nodes: MdNode[] = [{ type: "code", lang: "md", text: "![x](https://example.test/bird.png)", escaped: false }];

    await store.collect(nodes);

    expect(http.asked).toEqual([]);
    expect(store.fetched).toBe(0);
    expect(store.lookup("https://example.test/bird.png")).toBeNull();
  });
});

describe("NoRemoteImages", () => {
  it("fetches nothing and finds nothing", async () => {
    const store = new NoRemoteImages();

    await store.collect(picture("https://example.test/bird.png"));

    expect(store.fetched).toBe(0);
    expect(store.lookup("https://example.test/bird.png")).toBeNull();
  });
});
