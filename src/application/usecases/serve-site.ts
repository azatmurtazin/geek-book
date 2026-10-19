// `serve`'s use case: preview a built website on the host running the CLI.
//
// The reader names a directory (relative to the book root) and a port, or
// neither; the defaults are the website output directory and `serve.port`. The
// directory has to exist — the usual reason it does not is that no website has
// been built yet — so that is the one failure, and it says which command fixes
// it. Starting the server is the `SiteServer` port's business.

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
  /** A port; `serve.port` from the config by default. */
  readonly port?: number;
}

export interface ServeSite {
  readonly root: string;
  readonly port: number;
  readonly url: string;
  /** Keeps the process alive; stop the server with `close()`. */
  readonly handle: SiteHandle;
}

/** Serve the built website until the process ends. */
export function serveSite(deps: ServeSiteDeps, options: ServeSiteOptions): Result<ServeSite> {
  const { settings } = deps;
  const root = options.dir ? resolve(settings.root, options.dir) : settings.outputWeb;
  if (!deps.fs.exists(root)) {
    return fail({
      severity: "error",
      code: "serve/no-directory",
      message: `serve: ${root}: no such directory (run 'geek-book web' first)`,
    });
  }

  const port = options.port ?? settings.serve.port;
  const handle = deps.server.listen(root, port, (url) => deps.logger.info(`serve: ${url} → ${root}`));
  return ok({ root, port, url: `http://localhost:${port}`, handle });
}
