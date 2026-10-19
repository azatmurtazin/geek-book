// The Node implementation of the SiteServer port: a minimal static file server.
//
// It implements the application's `SiteServer` port for previewing a built
// website: a request maps to a file under the root, a directory serves its
// `index.html`, and a file is streamed back with the type its extension names.
// Requests that climb out of the root with `..` are refused.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import type { SiteHandle, SiteServer } from "../../application/ports/site-server.js";

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

export class NodeSiteServer implements SiteServer {
  listen(root: string, port: number, onReady: (url: string) => void): SiteHandle {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      let file = path.normalize(path.join(root, decodeURIComponent(url.pathname)));
      if (!file.startsWith(path.join(root, "")) && file !== root) {
        res.writeHead(403).end("Forbidden");
        return;
      }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
        const index = path.join(file, "index.html");
        // A directory served as its index: a request without the trailing slash
        // is moved there first, so the page's relative links resolve from the
        // directory rather than from its parent.
        if (fs.existsSync(index)) {
          if (!url.pathname.endsWith("/")) {
            res.writeHead(301, { location: `${url.pathname}/${url.search}` });
            res.end();
            return;
          }
          file = index;
        }
      }
      if (!fs.existsSync(file)) {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("404 Not Found");
        return;
      }
      const type = MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
      res.writeHead(200, { "content-type": type });
      fs.createReadStream(file).pipe(res);
    });

    server.listen(port, () => onReady(`http://localhost:${port}`));
    return { close: () => server.close() };
  }
}
