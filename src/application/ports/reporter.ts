// The Reporter port: the one way a diagnostic becomes text.
//
// Implemented by an adapter (today `ConsoleReporter`), called by the CLI once a
// use case returns its `Result`. Keeping this behind an interface is what lets
// the domain and application layers stay free of `console`/`process`.

import type { Diagnostic } from "../../domain/diagnostics.js";

/** Renders diagnostics. Errors go to the error stream; warnings/notes do not. */
export interface Reporter {
  report(diagnostic: Diagnostic): void;
}
