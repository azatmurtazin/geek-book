// The SiteServer port: serving a built website for a reader to click through.
//
// The filesystem and the sockets are an adapter's business
// (`adapters/http/node-site-server.ts`); the use case decides *what* to serve —
// which directory, which port — and says so through `listen`. The callback
// carries the address once the socket is bound, because only the adapter knows
// which port the kernel actually gave it.

/** A running server: stopping it releases the port and lets the process exit. */
export interface SiteHandle {
  close(): void;
}

export interface SiteServer {
  /**
   * Serve the files under `root` on `port`. `onReady` is called once, with the
   * site's URL, as soon as the socket is listening.
   */
  listen(root: string, port: number, onReady: (url: string) => void): SiteHandle;
}
