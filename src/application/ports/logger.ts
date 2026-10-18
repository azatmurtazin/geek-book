// The Logger port: progress lines, not diagnostics.
//
// "Built the site", "fetched 2 remote images" and similar go through this; a
// failure goes through the `Reporter` as a `Diagnostic`. The split keeps the
// two kinds of output separately configurable and testable.

/** Writes one informational line. */
export interface Logger {
  info(message: string): void;
}
