// The console adapter of the Reporter port: one diagnostic, one line, on the
// stream its severity belongs to. The format is the engine's existing one, so
// routing a message through the reporter is not supposed to change its text.

import { describe, expect, it } from "vitest";
import {
  ConsoleReporter,
  formatDiagnostic,
} from "../../../src/adapters/reporting/console-reporter.js";
import type { Diagnostic } from "../../../src/domain/diagnostics.js";

/** A writable stream that keeps what it was given. */
function capture(): { text: () => string; write: (chunk: string) => boolean } {
  let text = "";
  return {
    text: () => text,
    write: (chunk: string) => {
      text += chunk;
      return true;
    },
  };
}

describe("formatDiagnostic", () => {
  it("prints the severity and the message", () => {
    expect(formatDiagnostic({ severity: "error", code: "x/y", message: "no" })).toBe("error: no");
  });

  it("puts a file and line before the message", () => {
    expect(
      formatDiagnostic({
        severity: "error",
        code: "link/missing",
        message: "a link points nowhere",
        locus: { file: "chapters/01.md", line: 4 },
      }),
    ).toBe("error: chapters/01.md:4: a link points nowhere");
  });

  it("keeps the file but drops the colon when there is no line", () => {
    expect(
      formatDiagnostic({
        severity: "warning",
        code: "summary/unlisted",
        message: "a chapter is not listed",
        locus: { file: "book/SUMMARY.md" },
      }),
    ).toBe("warning: book/SUMMARY.md: a chapter is not listed");
  });

  it("prints a note like any other severity", () => {
    expect(formatDiagnostic({ severity: "note", code: "images/remote", message: "1 fetched" })).toBe(
      "note: 1 fetched",
    );
  });
});

describe("ConsoleReporter", () => {
  it("writes errors to the error stream", () => {
    const out = capture();
    const err = capture();
    new ConsoleReporter(out, err).report({
      severity: "error",
      code: "cli/unknown-command",
      message: "unknown command 'nope'",
    });
    expect(err.text()).toBe("error: unknown command 'nope'\n");
    expect(out.text()).toBe("");
  });

  it("writes warnings and notes to the other stream", () => {
    const out = capture();
    const err = capture();
    const reporter: ConsoleReporter = new ConsoleReporter(out, err);
    reporter.report({ severity: "warning", code: "w", message: "careful" });
    reporter.report({ severity: "note", code: "n", message: "by the way" });
    expect(out.text()).toBe("warning: careful\nnote: by the way\n");
    expect(err.text()).toBe("");
  });

  it("appends one line per diagnostic", () => {
    const out = capture();
    const err = capture();
    const reporter: ConsoleReporter = new ConsoleReporter(out, err);
    const diagnostic: Diagnostic = {
      severity: "error",
      code: "x",
      message: "first",
      locus: { file: "a.md", line: 2 },
    };
    reporter.report(diagnostic);
    reporter.report(diagnostic);
    expect(err.text()).toBe("error: a.md:2: first\nerror: a.md:2: first\n");
  });
});
