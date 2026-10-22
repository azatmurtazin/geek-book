// The SiteServer port: serving a built website for a reader to click through.
//
// The filesystem and the sockets are an adapter's business
// (`adapters/http/node-site-server.ts`); the use case decides *what* to serve —
// which directory, which port — and asks the adapter to bind it. The adapter
// reports the address it actually bound, because port 0 lets the kernel choose
// one. A refused bind is a diagnostic, not an exception.

import type { Result } from "../../domain/diagnostics.js";

/** A running server: stopping it releases the port and lets the process exit. */
export interface SiteHandle {
  close(): void;
}

/** The address a bind produced: what a reader opens, and the socket behind it. */
export interface SiteListening {
  /** The URL of the site as bound, with the real port even when 0 was asked for. */
  readonly url: string;
  /** The port the socket actually bound. */
  readonly port: number;
  readonly handle: SiteHandle;
}

export interface SiteServer {
  /**
   * Serve the files under `root` on `port`, or fail with a diagnostic when the
   * port is invalid or already in use. `port` 0 asks the kernel for a free one.
   */
  listen(root: string, port: number): Promise<Result<SiteListening>>;
}
