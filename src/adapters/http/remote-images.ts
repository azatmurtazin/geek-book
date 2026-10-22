// Remote image sources: `![A bird](https://example.org/bird.png)`.
//
// A printed book cannot hotlink, and a book that pulls a picture off someone
// else's server at reading time breaks the day that server does. So the build
// fetches every remote image once per run, into the build directory (which is
// disposable and git-ignored), and both editions then read the local copy —
// the website ships it, the print build embeds it. A book that uses remote
// images therefore needs the network to build; `geek-book lint` says which
// sources those are, and a fetch that fails stops the build with the URL.
//
// Files are named after the source URL: `<sha1 of the url><extension>`, the
// extension taken from the server's content type. Names are stable across
// builds, and one URL used in several chapters is fetched once.
//
// The network and the disk arrive as ports (`HttpClient`, `FileSystem`), so
// this adapter decides only what a status, a content type and an extension
// mean; the digest is the one thing it does itself.

import { createHash } from "node:crypto";
import { isRemoteImage } from "../../domain/services/resolve-images.js";
import { extname, join } from "../../domain/values/posix-path.js";
import type { MdInline, MdNode } from "../../domain/model/markdown.js";
import type { FileSystem } from "../../application/ports/file-system.js";
import type { HttpClient } from "../../application/ports/http-client.js";
import type { ImageStore, StoredImage } from "../../application/ports/image-store.js";
import { DEFAULT_IMAGE_MAX_BYTES } from "../../application/settings/defaults.js";

/** Extension for each content type a server may label an image with. */
const CONTENT_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/bmp": ".bmp",
  "image/tiff": ".tif",
  "image/svg+xml": ".svg",
};

/** Extensions that mark a URL as pointing at an image, for unlabeled hosts. */
const EXTRA_IMAGE_EXTENSIONS = [".jpeg", ".tiff"];

/** Content types servers send when they do not label the file: trust the URL. */
const UNLABELED = new Set(["", "application/octet-stream", "binary/octet-stream"]);

/** What LuaTeX reads off disk without a converter. */
const PRINT_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".pdf"]);

/** Seconds one fetch may take when the config names no timeout. */
const DEFAULT_TIMEOUT_S = 30;

/** How many image fetches may be in flight at once. */
const DEFAULT_CONCURRENCY = 4;

export interface RemoteImageOptions {
  /** Reject formats the printed edition cannot embed. */
  print?: boolean;
  /** Seconds one fetch may take before it fails (default 30). */
  timeout?: number;
  /** The largest response a fetch accepts, in bytes (default 20 MiB). */
  maxBytes?: number;
  /** How many fetches may run at once (default 4). */
  concurrency?: number;
  /** Accepted content type → the extension the file is saved as (default: the
   * built-in map). */
  types?: Record<string, string>;
}

/**
 * The remote images one build has fetched, keyed by source URL.
 *
 * `collect` is called with a chapter's Markdown before it is rendered, so that
 * by the time a renderer asks `nameFor` the file is already on disk.
 */
export class RemoteImages implements ImageStore {
  private readonly dir: string;
  private readonly http: HttpClient;
  private readonly fs: FileSystem;
  private readonly print: boolean;
  private readonly timeoutMs: number;
  private readonly maxBytes: number;
  private readonly concurrency: number;
  private readonly types: Record<string, string>;
  private readonly extensions: Set<string>;
  private readonly files = new Map<string, string>();
  private downloads = 0;

  constructor(dir: string, http: HttpClient, fs: FileSystem, options: RemoteImageOptions = {}) {
    this.dir = dir;
    this.http = http;
    this.fs = fs;
    this.print = options.print === true;
    this.timeoutMs = (options.timeout ?? 0) > 0 ? (options.timeout as number) * 1000 : DEFAULT_TIMEOUT_S * 1000;
    this.maxBytes = options.maxBytes ?? DEFAULT_IMAGE_MAX_BYTES;
    this.concurrency =
      Number.isInteger(options.concurrency) && (options.concurrency as number) > 0
        ? (options.concurrency as number)
        : DEFAULT_CONCURRENCY;
    // An empty map is the engine's own: a book only names types to narrow or
    // extend what a fetch accepts.
    this.types = options.types && Object.keys(options.types).length > 0 ? options.types : CONTENT_TYPES;
    this.extensions = new Set([...Object.values(this.types), ...EXTRA_IMAGE_EXTENSIONS]);
  }

  /** How many files this build fetched; repeats of a URL do not count again. */
  get fetched(): number {
    return this.downloads;
  }

  /** The file a URL was fetched into, as `<name>` inside the download directory. */
  nameFor(url: string): string | null {
    return this.files.get(url.trim()) ?? null;
  }

  /** The absolute path a URL was fetched to, or `null` when this build has not. */
  fileFor(url: string): string | null {
    const name = this.files.get(url.trim());
    return name === undefined ? null : join(this.dir, name);
  }

  /** Where a URL's fetched copy is, or `null` when this build did not fetch it. */
  lookup(url: string): StoredImage | null {
    const name = this.nameFor(url);
    const file = this.fileFor(url);
    return name === null || file === null ? null : { file, name };
  }

  /** Fetch every remote image the neutral tree references, ignoring code samples. */
  async collect(nodes: readonly MdNode[]): Promise<void> {
    const urls: string[] = [];
    collectRemoteUrls(nodes, urls);
    const pending = urls.filter((url) => !this.files.has(url));
    if (pending.length === 0) {
      return;
    }

    // Workers claim URLs in reading order. Once one fails, no new URL starts,
    // but every earlier URL has already been claimed; the lowest-index failure
    // is therefore the same one a sequential build would have reported.
    const failures: (Error | undefined)[] = new Array(pending.length);
    let next = 0;
    let halted = false;
    const worker = async (): Promise<void> => {
      for (;;) {
        if (halted) return;
        const index = next;
        next += 1;
        if (index >= pending.length) return;
        try {
          await this.fetch(pending[index]);
        } catch (error) {
          failures[index] = error as Error;
          halted = true;
        }
      }
    };

    const workers = Array.from({ length: Math.min(this.concurrency, pending.length) }, () => worker());
    await Promise.all(workers);

    const first = failures.findIndex((error) => error !== undefined);
    if (first !== -1) {
      throw failures[first];
    }
  }

  private async fetch(url: string): Promise<void> {
    let response;
    try {
      response = await this.http.get(url, { timeoutMs: this.timeoutMs, maxBytes: this.maxBytes });
    } catch (error) {
      throw new Error(`cannot fetch image ${url}: ${(error as Error).message}`);
    }
    if (!response.ok) {
      throw new Error(`cannot fetch image ${url}: HTTP ${response.status}`);
    }
    const type = response.contentType.split(";")[0].trim().toLowerCase();
    const ext = this.extensionFor(type, url);
    if (ext === null) {
      throw new Error(`not an image: ${url} (served ${type || "no content type"})`);
    }
    if (this.print && !PRINT_EXTENSIONS.has(ext)) {
      throw new Error(`the printed edition cannot embed ${url} (${type}); it reads png and jpeg`);
    }
    const name = `${createHash("sha1").update(url).digest("hex").slice(0, 12)}${ext}`;
    this.fs.makeDirs(this.dir);
    this.fs.writeBytes(join(this.dir, name), response.body);
    this.files.set(url, name);
    this.downloads += 1;
  }

  /** The extension to save a fetched image under, or `null` when the type is
   *  not one this build accepts. An unlabeled host falls back to the URL. */
  private extensionFor(contentType: string, url: string): string | null {
    const byType = this.types[contentType];
    if (byType) {
      return byType;
    }
    if (UNLABELED.has(contentType)) {
      const ext = extname(new URL(url).pathname).toLowerCase();
      if (this.extensions.has(ext)) {
        return ext;
      }
    }
    return null;
  }
}

/** An `ImageStore` for a chapter with no remote cache: fetches nothing, finds
 *  nothing. The pure walk and the fixture chapters use it. */
export class NoRemoteImages implements ImageStore {
  async collect(_nodes: readonly MdNode[]): Promise<void> {}

  lookup(_url: string): StoredImage | null {
    return null;
  }

  readonly fetched = 0;
}

/** Every remote image URL the neutral tree references, in order, once each. */
function collectRemoteUrls(nodes: readonly MdNode[], out: string[]): void {
  for (const node of nodes) {
    switch (node.type) {
      case "heading":
      case "paragraph":
      case "text":
        collectInlineUrls(node.inline, out);
        break;
      case "blockquote":
        collectRemoteUrls(node.children, out);
        break;
      case "list":
        for (const item of node.items) collectRemoteUrls(item, out);
        break;
      case "table":
        for (const cell of node.header) collectInlineUrls(cell, out);
        for (const row of node.rows) for (const cell of row) collectInlineUrls(cell, out);
        break;
      default:
        // code, rule and html carry no pictures.
        break;
    }
  }
}

function collectInlineUrls(nodes: readonly MdInline[], out: string[]): void {
  for (const node of nodes) {
    switch (node.type) {
      case "image": {
        const src = node.href.trim();
        if (isRemoteImage(src) && !out.includes(src)) out.push(src);
        break;
      }
      case "strong":
      case "em":
      case "del":
      case "link":
        collectInlineUrls(node.children, out);
        break;
      default:
        break;
    }
  }
}
