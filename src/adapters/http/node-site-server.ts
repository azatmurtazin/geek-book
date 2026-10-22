// The Node implementation of the SiteServer port: a minimal static file server.
//
// It implements the application's `SiteServer` port for previewing a built
// website: a request maps to a file under the root, a directory serves its
// `index.html`, and a file is streamed back with the type its extension names.
// Requests that climb out of the root with `..` or a symlink are refused.
//
// Binding is part of the Result contract: an invalid port, a port already in
// use, or a root that is not a directory is a diagnostic, never a stack trace.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fail, ok, type Result } from "../../domain/diagnostics.js";
import type { SiteListening, SiteServer } from "../../application/ports/site-server.js";

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

const PLAIN_TEXT = "text/plain; charset=utf-8";

function notFound(res: http.ServerResponse): void {
  res.writeHead(404, { "content-type": PLAIN_TEXT }).end("404 Not Found");
}

function forbidden(res: http.ServerResponse): void {
  res.writeHead(403, { "content-type": PLAIN_TEXT }).end("403 Forbidden");
}

/** Whether `target` is `base` or a descendant of it, after both are real paths. */
function inside(base: string, target: string): boolean {
  const rel = path.relative(base, target);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/** A diagnostic for a socket that could not bind, worded for the terminal. */
function listenFailure(port: number, error: NodeJS.ErrnoException): Result<SiteListening> {
  if (error.code === "EADDRINUSE") {
    return fail({
      severity: "error",
      code: "serve/address-in-use",
      message: `serve: localhost:${port}: address already in use (choose another port)`,
    });
  }
  return fail({
    severity: "error",
    code: "serve/cannot-listen",
    message: `serve: localhost:${port}: ${error.message}`,
  });
}

export class NodeSiteServer implements SiteServer {
  async listen(root: string, port: number): Promise<Result<SiteListening>> {
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
      return fail({
        severity: "error",
        code: "serve/bad-port",
        message: `serve: ${port}: port must be an integer between 0 and 65535`,
      });
    }

    // Resolve the root once: a request's path is checked against the real
    // directory, so a symlink inside the site cannot become a second root.
    let base: string;
    try {
      base = fs.realpathSync(path.resolve(root));
      if (!fs.statSync(base).isDirectory()) throw new Error("not a directory");
    } catch {
      return fail({
        severity: "error",
        code: "serve/no-directory",
        message: `serve: ${root}: no such directory (run 'geek-book web' first)`,
      });
    }

    const server = http.createServer((req, res) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405, { allow: "GET, HEAD", "content-type": PLAIN_TEXT }).end("405 Method Not Allowed");
        return;
      }

      let url: URL;
      try {
        url = new URL(req.url ?? "/", "http://localhost");
      } catch {
        res.writeHead(400, { "content-type": PLAIN_TEXT }).end("400 Bad Request");
        return;
      }

      // The URL parser normalizes literal `..` segments but leaves encoded
      // ones alone, so decoding can still produce a path that climbs out.
      let pathname: string;
      try {
        pathname = decodeURIComponent(url.pathname);
      } catch {
        res.writeHead(400, { "content-type": PLAIN_TEXT }).end("400 Bad Request");
        return;
      }

      // `.` keeps a root-relative request relative; `resolve` collapses any
      // `..` that is left, and `relative` accepts only what stayed inside.
      let file = path.resolve(base, `.${pathname}`);
      if (!inside(base, file)) {
        forbidden(res);
        return;
      }

      try {
        // `statSync` follows symlinks; resolving the real path afterwards is
        // what keeps a link to a sibling directory from escaping the root.
        file = fs.realpathSync(file);
        if (!inside(base, file)) {
          forbidden(res);
          return;
        }

        if (fs.statSync(file).isDirectory()) {
          const index = path.join(file, "index.html");
          if (!fs.statSync(index).isFile()) {
            notFound(res);
            return;
          }
          file = fs.realpathSync(index);
          if (!inside(base, file)) {
            forbidden(res);
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
        } else if (!fs.statSync(file).isFile()) {
          notFound(res);
          return;
        }
      } catch {
        notFound(res);
        return;
      }

      const type = MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
      res.writeHead(200, { "content-type": type });
      if (req.method === "HEAD") {
        res.end();
        return;
      }

      const stream = fs.createReadStream(file);
      // The file can go away between the stat and the read; without this the
      // stream's error would be unhandled and take the preview down.
      stream.on("error", () => res.destroy());
      stream.pipe(res);
    });

    return new Promise((resolve) => {
      const onError = (error: NodeJS.ErrnoException) => {
        server.off("listening", onListening);
        resolve(listenFailure(port, error));
      };
      const onListening = () => {
        server.off("error", onError);
        // Port 0 asks the kernel for a free port; the callback has to name the
        // one it actually bound, not the zero it was asked for.
        const address = server.address();
        const bound = typeof address === "object" && address !== null ? address.port : port;
        resolve(
          ok({
            url: `http://localhost:${bound}`,
            port: bound,
            handle: { close: () => server.close() },
          }),
        );
      };

      server.once("error", onError);
      server.once("listening", onListening);
      try {
        server.listen(port);
      } catch (error) {
        server.off("error", onError);
        server.off("listening", onListening);
        resolve(listenFailure(port, error as NodeJS.ErrnoException));
      }
    });
  }
}
