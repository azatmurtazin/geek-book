// What the composition root hands a command.
//
// One plain object, no container: an adapter for each port the run may need,
// built around the resolved settings. A command declares the ports it uses
// through this shape rather than importing an adapter itself, and reads nothing
// about *which* book is being built except `settings`.

import type { BookSettings } from "../application/settings.js";
import type { FileSystem } from "../application/ports/file-system.js";
import type { TemplateStore } from "../application/ports/template-store.js";
import type { Reporter } from "../application/ports/reporter.js";
import type { Logger } from "../application/ports/logger.js";

/** The adapters and settings a command may use, built once by the root. */
export interface AppContext {
  readonly settings: BookSettings;
  readonly fs: FileSystem;
  readonly templates: TemplateStore;
  readonly reporter: Reporter;
  readonly logger: Logger;
}

/** One `geek-book` subcommand. */
export interface Command {
  /** One-liner for the help text. */
  readonly summary: string;
  /** Run it; the number is the process exit code. */
  run(ctx: AppContext, args: string[]): Promise<number> | number;
}
