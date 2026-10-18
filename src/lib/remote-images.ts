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

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isRemoteImage } from "./images.js";
import { markedInstance } from "./markdown.js";
import type { BookConfig } from "./book-config.js";

/** Where remote images land inside a web build, relative to its root. */
export const REMOTE_IMAGE_DIR = "images/remote";

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

export interface RemoteImageOptions {
  /** Reject formats the printed edition cannot embed. */
  print?: boolean;
  /** Seconds one fetch may take before it fails (default 30). */
  timeout?: number;
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
export class RemoteImages {
  private readonly cfg: BookConfig;
  private readonly dir: string;
  private readonly print: boolean;
  private readonly timeoutMs: number;
  private readonly types: Record<string, string>;
  private readonly extensions: Set<string>;
  private readonly files = new Map<string, string>();
  private downloads = 0;

  constructor(cfg: BookConfig, dir: string, options: RemoteImageOptions = {}) {
    this.cfg = cfg;
    this.dir = dir;
    this.print = options.print === true;
    this.timeoutMs = (options.timeout ?? 0) > 0 ? (options.timeout as number) * 1000 : 30_000;
    // An empty map is the engine's own: a book only names types to narrow or
    // extend what a fetch accepts.
    this.types = options.types && Object.keys(options.types).length > 0 ? options.types : CONTENT_TYPES;
    this.extensions = new Set([...Object.values(this.types), ".jpeg", ".tiff"]);
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
    return name === undefined ? null : path.join(this.dir, name);
  }

  /** Fetch every remote image `markdown` references, ignoring code samples. */
  async collect(markdown: string): Promise<void> {
    const urls: string[] = [];
    const md = markedInstance(this.cfg);
    md.walkTokens(md.lexer(markdown), (token) => {
      if (token.type !== "image") {
        return;
      }
      const src = ((token as { href?: string }).href ?? "").trim();
      if (isRemoteImage(src) && !urls.includes(src)) {
        urls.push(src);
      }
    });
    for (const url of urls) {
      if (!this.files.has(url)) {
        await this.fetch(url);
      }
    }
  }

  private async fetch(url: string): Promise<void> {
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "follow",
        headers: { "user-agent": "geek-book" },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new Error(`cannot fetch image ${url}: ${(error as Error).message}`);
    }
    if (!response.ok) {
      throw new Error(`cannot fetch image ${url}: HTTP ${response.status}`);
    }
    const type = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const ext = this.extensionFor(type, url);
    if (ext === null) {
      throw new Error(`not an image: ${url} (served ${type || "no content type"})`);
    }
    if (this.print && !PRINT_EXTENSIONS.has(ext)) {
      throw new Error(`the printed edition cannot embed ${url} (${type}); it reads png and jpeg`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    const name = `${createHash("sha1").update(url).digest("hex").slice(0, 12)}${ext}`;
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(path.join(this.dir, name), bytes);
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
      const ext = path.posix.extname(new URL(url).pathname).toLowerCase();
      if (this.extensions.has(ext)) {
        return ext;
      }
    }
    return null;
  }
}
