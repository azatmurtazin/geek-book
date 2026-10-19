// The `node:child_process` implementation of the ProcessRunner port.
//
// One synchronous `spawnSync`, buffering as much output as a LaTeX run can
// produce. A missing binary is reported as `missing` (never thrown), so the
// caller can try another install path or print an install hint; a non-zero exit
// is `failed`.

import { spawnSync } from "node:child_process";
import type { ProcessResult, ProcessRunner } from "../../application/ports/process-runner.js";

export class NodeProcessRunner implements ProcessRunner {
  run(command: string, args: readonly string[], options: { cwd?: string } = {}): ProcessResult {
    const result = spawnSync(command, [...args], {
      cwd: options.cwd,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });

    if (result.error) {
      const code = (result.error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return { kind: "missing", tool: command };
      }
      return { kind: "failed", message: result.error.message, stdout: "", stderr: "" };
    }

    const stdout = result.stdout ?? "";
    const stderr = result.stderr ?? "";
    if (result.status === 0) {
      return { kind: "ok", stdout, stderr };
    }
    return {
      kind: "failed",
      message: stderr.trim() || `${command} exited with status ${result.status}`,
      stdout,
      stderr,
    };
  }
}
