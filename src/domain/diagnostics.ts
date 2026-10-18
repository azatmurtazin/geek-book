// Failures as values.
//
// A use case returns a `Result`: either the value it produced or the
// diagnostics that explain why it could not. Nothing in `domain/` (or later
// `application/`) writes to a stream or chooses an exit code — the CLI is the
// only place that turns a failure into a number, and the `Reporter` port is
// the only place that turns a `Diagnostic` into a line of text.
//
// Pure: no imports outside `domain/` (see docs/ARCHITECTURE_REFACTORING_PLAN.md
// §3 and `domain-is-pure` in .dependency-cruiser.cjs).

/** How loud a diagnostic is. The word doubles as the printed prefix. */
export type Severity = "error" | "warning" | "note";

/** Where a diagnostic points, when it points somewhere. `file` is book-relative. */
export interface Locus {
  readonly file: string;
  /** 1-based line in `file`. */
  readonly line?: number;
  /** 1-based column in `file`. */
  readonly column?: number;
}

/** One finding: what is wrong, how bad, and where. */
export interface Diagnostic {
  readonly severity: Severity;
  /** Stable identifier for the check that produced it, e.g. "link/missing". */
  readonly code: string;
  readonly message: string;
  readonly locus?: Locus;
}

/** Either a value, or the diagnostics that prevented one. */
export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] };

/** A successful result. */
export const ok = <T>(value: T): Result<T> => ({ ok: true, value });

/** A failed result: one diagnostic, optionally followed by more. */
export const fail = (diagnostic: Diagnostic, ...rest: Diagnostic[]): Result<never> => ({
  ok: false,
  diagnostics: [diagnostic, ...rest],
});

/**
 * All values, or every diagnostic any of the results carried. Used to run a
 * batch of independent checks and report all of them at once rather than
 * stopping at the first failure.
 */
export function combine<T>(results: readonly Result<T>[]): Result<readonly T[]> {
  const values: T[] = [];
  const diagnostics: Diagnostic[] = [];
  for (const result of results) {
    if (result.ok) values.push(result.value);
    else diagnostics.push(...result.diagnostics);
  }
  return diagnostics.length === 0 ? ok(values) : { ok: false, diagnostics };
}

/** Transform a success and pass a failure through untouched. */
export function mapResult<T, U>(result: Result<T>, transform: (value: T) => U): Result<U> {
  return result.ok ? ok(transform(result.value)) : result;
}
