// Minimal static file server for previewing the built website.
//
// Usage: geek-book serve [DIRECTORY] [PORT]
// (DIRECTORY resolves from the book root; default: the web output dir, and the
// port defaults to `serve.port` in book.config.json, 4000 by default.)

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import type { BookConfig } from "../lib/book-config.js";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export function main(cfg: BookConfig, args: string[]): number {
  let dir: string | null = null;
  let port = String(cfg.serve.port);
  for (const arg of args) {
    if (/^\d+$/.test(arg)) {
      port = arg;
    } else {
      dir = arg;
    }
  }
  const root = dir ? path.resolve(cfg.root, dir) : cfg.outputWeb;
  if (!fs.existsSync(root)) {
    process.stderr.write(`serve: ${root}: no such directory (run 'geek-book web' first)\n`);
    return 1;
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    let file = path.normalize(path.join(root, decodeURIComponent(url.pathname)));
    if (!file.startsWith(path.join(root, "")) && file !== root) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      file = path.join(file, "index.html");
    }
    if (!fs.existsSync(file)) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("404 Not Found");
      return;
    }
    const type = MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
    res.writeHead(200, { "content-type": type });
    fs.createReadStream(file).pipe(res);
  });

  server.listen(Number(port), () => {
    console.log(`serve: http://localhost:${port} → ${root}`);
  });
  return 0;
}
