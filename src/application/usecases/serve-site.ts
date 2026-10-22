// `serve`'s use case: preview a built website on the host running the CLI.
//
// The reader names a directory (relative to the book root) and a port, or
// neither; the defaults are the website output directory and `serve.port`. The
// directory has to exist — the usual reason it does not is that no website has
// been built yet — and the socket has to bind. Both are values, not exceptions:
// a missing build and an occupied port each become one `serve:` diagnostic.
//
// The adapter owns the socket and reports the address it actually bound, so
// `port: 0` (the kernel picks) still logs and returns a real URL.

import { fail, ok, type Result } from "../../domain/diagnostics.js";
import { resolve } from "../../domain/values/posix-path.js";
import type { FileSystem } from "../ports/file-system.js";
import type { Logger } from "../ports/logger.js";
import type { SiteHandle, SiteServer } from "../ports/site-server.js";
import type { BookSettings } from "../settings.js";

export interface ServeSiteDeps {
  readonly settings: BookSettings;
  readonly fs: FileSystem;
  readonly server: SiteServer;
  readonly logger: Logger;
}

/** What the reader asked for: a directory under the book, and a port. */
export interface ServeSiteOptions {
  /** A directory relative to the book root; the website output by default. */
  readonly dir?: string;
  /** A port; `serve.port` from the config by default. `0` picks a free one. */
  readonly port?: number;
}

export interface ServeSite {
  readonly root: string;
  /** The port actually bound, which differs from the request when it was 0. */
  readonly port: number;
  readonly url: string;
  /** Keeps the process alive; stop the server with `close()`. */
  readonly handle: SiteHandle;
}

/** The directory a serve request names, or the book's website output. */
export function serveRoot(settings: BookSettings, dir: string | undefined): string {
  return dir ? resolve(settings.root, dir) : settings.outputWeb;
}

/** Serve the built website until the process ends. */
export async function serveSite(deps: ServeSiteDeps, options: ServeSiteOptions): Promise<Result<ServeSite>> {
  const { settings } = deps;
  const root = serveRoot(settings, options.dir);
  if (!deps.fs.exists(root)) {
    return fail({
      severity: "error",
      code: "serve/no-directory",
      message: `serve: ${root}: no such directory (run 'geek-book web' first)`,
    });
  }

  const port = options.port ?? settings.serve.port;
  const listening = await deps.server.listen(root, port);
  if (!listening.ok) return listening;

  const { url, port: boundPort, handle } = listening.value;
  deps.logger.info(`serve: ${url} → ${root}`);
  return ok({ root, port: boundPort, url, handle });
}
