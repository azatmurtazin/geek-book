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
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function notFound(res: http.ServerResponse): void {
  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("404 Not Found");
}

export class NodeSiteServer implements SiteServer {
  listen(root: string, port: number, onReady: (url: string) => void): SiteHandle {
    const base = path.resolve(root);

    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");

      // The URL parser normalizes literal `..` segments but leaves encoded
      // ones alone, so decoding can still produce a path that climbs out.
      let pathname: string;
      try {
        pathname = decodeURIComponent(url.pathname);
      } catch {
        res.writeHead(400, { "content-type": "text/plain; charset=utf-8" }).end("400 Bad Request");
        return;
      }

      // `.` keeps a root-relative request relative; `resolve` collapses any
      // `..` that is left, and `relative` accepts only what stayed inside.
      let file = path.resolve(base, `.${pathname}`);
      const rel = path.relative(base, file);
      if (rel.startsWith("..") || path.isAbsolute(rel)) {
        res.writeHead(403).end("Forbidden");
        return;
      }

      try {
        if (fs.statSync(file).isDirectory()) {
          const index = path.join(file, "index.html");
          if (!fs.statSync(index).isFile()) {
            notFound(res);
            return;
          }
          // A directory served as its index: a request without the trailing
          // slash is moved there first, so the page's relative links resolve
          // from the directory rather than from its parent.
          if (!url.pathname.endsWith("/")) {
            res.writeHead(301, { location: `${url.pathname}/${url.search}` });
            res.end();
            return;
          }
          file = index;
        }
      } catch {
        notFound(res);
        return;
      }

      const type = MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
      res.writeHead(200, { "content-type": type });
      const stream = fs.createReadStream(file);
      // The file can go away between the stat and the read; without this the
      // stream's error would be unhandled and take the preview down.
      stream.on("error", () => res.destroy());
      stream.pipe(res);
    });

    server.listen(port, () => {
      // Port 0 asks the kernel for a free port; the callback has to name the
      // one it actually bound, not the zero it was asked for.
      const address = server.address();
      const bound = typeof address === "object" && address !== null ? address.port : port;
      onReady(`http://localhost:${bound}`);
    });
    return { close: () => server.close() };
  }
}
