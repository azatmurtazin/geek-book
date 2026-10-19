// The ProcessRunner port: running one external command to completion.
//
// The result says *how* a run ended — succeeded, failed, or the tool is not
// installed — so a caller can tell "LaTeX found a bad command" from "LaTeX is
// not installed" and print the right hint. Finding alternate install paths and
// naming output files is the caller's business (see
// `adapters/process/system-pdf-toolchain.ts`).

export interface ProcessRunner {
  run(command: string, args: readonly string[], options?: { cwd?: string }): ProcessResult;
}

export type ProcessResult =
  | { readonly kind: "ok"; readonly stdout: string; readonly stderr: string }
  | { readonly kind: "failed"; readonly message: string; readonly stdout: string; readonly stderr: string }
  | { readonly kind: "missing"; readonly tool: string };
