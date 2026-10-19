// The `node:child_process` ProcessRunner, exercised against the running Node.

import process from "node:process";
import { describe, expect, it } from "vitest";
import { NodeProcessRunner } from "../../../src/adapters/process/node-process-runner.js";

describe("NodeProcessRunner", () => {
  const runner = new NodeProcessRunner();

  it("reports a successful run with its output", () => {
    const result = runner.run(process.execPath, ["-e", "process.stdout.write('hi')"]);
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.stdout).toBe("hi");
    }
  });

  it("reports a non-zero exit as failed", () => {
    const result = runner.run(process.execPath, ["-e", "process.exit(3)"]);
    expect(result.kind).toBe("failed");
  });

  it("reports a missing tool rather than throwing", () => {
    const result = runner.run("geek-book-no-such-tool-xyz", []);
    expect(result).toEqual({ kind: "missing", tool: "geek-book-no-such-tool-xyz" });
  });
});
